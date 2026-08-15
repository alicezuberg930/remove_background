from fastapi.middleware.cors import CORSMiddleware

from routes import register_routes
from fastapi import FastAPI

server = FastAPI(title='Remove Background Service', version='1.0.0')

server.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

register_routes(server)
