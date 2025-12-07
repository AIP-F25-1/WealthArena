"""Test RayTrainer config assembly."""

from src.orchestration import RLlibConfig, RayTrainer, ResourceManager


def test_build_ppo_config_includes_env():
    trainer = RayTrainer(
        resource_manager=ResourceManager(num_cpus=4, num_gpus=0),
        rllib_config=RLlibConfig(base_config={}),
    )
    result = trainer.rllib_config.build_ppo_config(env="TradingEnv", policies={})
    assert result["env"] == "TradingEnv"
