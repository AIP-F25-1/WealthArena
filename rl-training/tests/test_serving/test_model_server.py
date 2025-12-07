"""Test model server registry interactions."""

from src.serving import InferenceOptimizer, ModelRegistry, ModelServer


def test_model_server_initialization():
    registry = ModelRegistry(store_path="./models")
    optimizer = InferenceOptimizer(cache={})
    server = ModelServer(registry=registry, optimizer=optimizer)
    assert server.registry.store_path == "./models"
