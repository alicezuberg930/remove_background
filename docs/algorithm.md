## How BiRefNet Works

BiRefNet means **Bilateral Reference Network**. It performs dichotomous image segmentation: every pixel is assigned a foreground probability, independent of the semantic class of the foreground object. Background removal is an application of that mask, not a separate operation performed inside the neural network.

BiRefNet is organized into a localization module and a reconstruction module. The localization module determines which object is foreground using global context. The reconstruction module progressively restores spatial resolution and fine boundaries. Bilateral reference supplies two complementary signals during reconstruction: original high-resolution image detail flowing inward and gradient-focused boundary attention flowing outward.

### Algorithm

```text
Input image I
    |
    v
Transformer encoder -> hierarchical features at 1/4, 1/8, 1/16, 1/32 scale
    |
    v
Localization module -> global semantics + ASPP multi-scale context
    |
    v
Coarse low-resolution foreground representation
    |
    v
Reconstruction module with repeated BiRef blocks
    |-- Inward reference: original-resolution image patches add fine source detail
    |-- Reconstruction block: hierarchical/deformable receptive fields fuse context
    |-- Outward reference: gradient-aware attention emphasizes detailed boundaries
    |
    v
Progressively higher-resolution predictions
    |
    v
Final one-channel foreground logits -> sigmoid -> probability mask
```

### Localization module

The transformer encoder extracts hierarchical features at progressively lower resolutions. Lateral connections preserve features for later decoder stages. Deep features are combined with global semantic supervision and atrous spatial pyramid pooling (ASPP), allowing the network to recognize a large foreground object while retaining context for smaller structures.

This stage answers the coarse question: **where is the foreground object?**

### Reconstruction module

The decoder progressively upsamples the coarse representation. Each stage combines the previous decoder result with the corresponding encoder feature through a lateral connection. BiRef reconstruction blocks use multiple receptive-field sizes, including `1x1`, `3x3`, and `7x7`, plus adaptive pooling. This balances broad context with local detail.

This stage answers the precise question: **which exact pixels and boundaries belong to the foreground?**

### Inward reference

Downsampling removes thin structures, hair, gaps, and sharp contours. Inward reference restores access to source detail by adaptively cropping the original high-resolution image into patches compatible with each decoder stage and fusing those patches with decoder features.

The direction is "inward" because intact information from the source image is injected into the reconstruction path.

### Outward reference

Outward reference predicts gradient-aware features and converts them into an attention map. The attention weights emphasize regions rich in useful foreground boundaries. A mask derived from intermediate foreground predictions suppresses strong background texture so that arbitrary background edges do not dominate the gradient signal.

The direction is "outward" because reconstructed features produce gradient predictions and attention that guide subsequent refinement.

### Training objective

The original BiRefNet training objective combines complementary supervision:

```text
L = lambda1 * BCE + lambda2 * IoU + lambda3 * SSIM + lambda4 * CE
```

| Loss | Purpose |
| --- | --- |
| BCE | Pixel-level foreground/background correctness. |
| IoU | Region-level overlap and complete object coverage. |
| SSIM | Structural and boundary fidelity. |
| CE | Semantic supervision for stronger localization features. |

Intermediate decoder outputs are also supervised during training. This multi-stage supervision improves convergence and teaches progressively refined predictions. These losses and gradient labels are training-time mechanisms; production inference only executes the learned forward pass and sigmoid.

### Repository-specific model serving

The repository does not implement BiRefNet layers directly. It loads the selected Hugging Face model with `trust_remote_code=True` and wraps it with preprocessing, serving, fallback, and alpha compositing.

## Operational Controls

The square inference canvas size is supplied per request through the required multipart `image_size` field and must be between `256` and `2048`.

| Variable | Default | Effect |
| --- | --- | --- |
| `BIREFNET_DEVICE` | Auto | Explicit device; otherwise CUDA when available, then CPU. |
| `BIREFNET_USE_HALF` | `true` | Enables FP16 model inference on CUDA. |
| `BIREFNET_PRESERVE_ASPECT_RATIO` | `true` | Uses letterboxing instead of geometric distortion. |
| `BIREFNET_PAD_COLOR` | `123,116,103` | RGB value for letterbox padding. |
| `BIREFNET_TIMEOUT_SECONDS` | `120` | Maximum inference duration. |
| `BIREFNET_ACQUIRE_TIMEOUT_SECONDS` | `10` | Maximum wait for a local worker. |
| `BIREFNET_WORKER_POOL_SIZE` | `1` | Number of local inference processes. |
| `REMOVE_BG_ALPHA_CLEANUP_ENABLED` | `true` | Enables alpha thresholding and optional smoothing. |
| `REMOVE_BG_ALPHA_LOW_THRESHOLD` | `10` | Forces low-confidence alpha to transparent. |
| `REMOVE_BG_ALPHA_HIGH_THRESHOLD` | `245` | Forces high-confidence alpha to opaque. |
| `REMOVE_BG_ALPHA_SMOOTH_ENABLED` | `true` | Smooths only partially transparent edges. |

## Sources

- [BiRefNet paper](https://arxiv.org/abs/2401.03407)
- [Official BiRefNet implementation](https://github.com/ZhengPeng7/BiRefNet)
- [Official BiRefNet model card](https://huggingface.co/ZhengPeng7/BiRefNet)
