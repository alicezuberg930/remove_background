import json
import os

import numpy as np
import torch
import triton_python_backend_utils as pb_utils
from transformers import AutoModelForImageSegmentation


def _extract_prediction(outputs):
    tensors = []

    def collect_tensors(value):
        if value is None:
            return
        if hasattr(value, 'logits'):
            collect_tensors(value.logits)
            return
        if hasattr(value, 'ndim'):
            tensors.append(value)
            return
        if isinstance(value, (list, tuple)):
            for item in value:
                collect_tensors(item)

    collect_tensors(outputs)
    if not tensors:
        raise ValueError('BiRefNet returned no tensor prediction')
    return tensors[-1]


def _parameter_value(parameters: dict, key: str, default: str) -> str:
    value = parameters.get(key)
    if not value:
        return default
    return value.get('string_value', default)


def _env_or_parameter(parameters: dict, env_name: str, key: str, default: str) -> str:
    env_value = (os.getenv(env_name, '') or '').strip()
    if env_value:
        return env_value
    return _parameter_value(parameters, key, default)


class TritonPythonModel:
    def initialize(self, args):
        model_config = json.loads(args['model_config'])
        parameters = model_config.get('parameters', {})

        self.model_id = _env_or_parameter(parameters, 'BIREFNET_MODEL_ID', 'model_id', 'ZhengPeng7/BiRefNet').strip()
        configured_device = _env_or_parameter(parameters, 'BIREFNET_DEVICE', 'device', '').strip().lower()
        configured_use_half = _env_or_parameter(parameters, 'BIREFNET_USE_HALF', 'use_half', 'true').strip().lower()

        if configured_device:
            device_name = configured_device
        else:
            device_name = 'cuda' if torch.cuda.is_available() else 'cpu'

        self.device = torch.device(device_name)
        self.use_half = configured_use_half in ('1', 'true', 'yes', 'on') and device_name.startswith('cuda')
        self.model = AutoModelForImageSegmentation.from_pretrained(
            self.model_id,
            trust_remote_code=True,
        )
        self.model.to(self.device)
        self.model.eval()
        if self.use_half:
            self.model.half()

    def execute(self, requests):
        responses = []

        with torch.no_grad():
            for request in requests:
                input_tensor = pb_utils.get_input_tensor_by_name(request, 'input')
                input_array = input_tensor.as_numpy()
                tensor = torch.from_numpy(input_array).to(self.device)
                if tensor.ndim == 3:
                    tensor = tensor.unsqueeze(0)
                if self.use_half:
                    tensor = tensor.half()

                outputs = self.model(tensor)
                pred_tensor = _extract_prediction(outputs).sigmoid().detach().float().cpu()
                if pred_tensor.ndim == 4:
                    pred_tensor = pred_tensor[:, 0, :, :]
                elif pred_tensor.ndim == 2:
                    pred_tensor = pred_tensor.unsqueeze(0)

                out_tensor = pb_utils.Tensor('mask', pred_tensor.numpy().astype(np.float32))
                responses.append(pb_utils.InferenceResponse(output_tensors=[out_tensor]))

        return responses

    def finalize(self):
        self.model = None
