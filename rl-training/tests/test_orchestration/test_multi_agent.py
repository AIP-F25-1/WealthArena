from __future__ import annotations

from src.orchestration.multi_agent_orchestrator import (
    AgentCommunicationBus,
    MultiAgentOrchestrator,
    StateManager,
    WorkflowBuilder,
)


def test_communication_bus_publish_subscribe():
    bus = AgentCommunicationBus()
    received = []

    def handler(message):
        received.append(message)

    bus.subscribe("signals", handler)
    bus.publish("signals", {"asset": "AAPL", "weight": 0.1})

    assert received == [{"asset": "AAPL", "weight": 0.1}]
    assert bus.get_latest_signals("signals")[0]["message"]["asset"] == "AAPL"


def test_orchestrator_builds_hierarchical_workflow():
    orchestrator = MultiAgentOrchestrator(
        communication_bus=AgentCommunicationBus(),
        state_manager=StateManager(),
        workflow_builder=WorkflowBuilder(),
    )

    orchestrator.register_agent("agent_alpha", lambda ctx: ctx)
    orchestrator.register_agent("agent_beta", lambda ctx: ctx)
    orchestrator.workflow_builder.add_edge("agent_alpha", "agent_beta")

    workflow = orchestrator.create_workflow(mode="hierarchical")

    assert set(workflow["nodes"].keys()) == {"agent_alpha", "agent_beta"}
    assert ("agent_alpha", "agent_beta") in workflow["edges"]
    for edge in workflow["edges"]:
        assert edge[0] in workflow["nodes"]
        assert edge[1] in workflow["nodes"]

    result = orchestrator.run_rebalancing_cycle({"timestamp": "2024-01-01"})
    assert "workflow" in result and "context" in result
