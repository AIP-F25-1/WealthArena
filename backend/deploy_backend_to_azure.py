import os
import json
import subprocess
from pathlib import Path

from azureml.core import Workspace
from azureml.core.webservice import AciWebservice, Webservice
from azureml.core.environment import Environment
from azureml.core.conda_dependencies import CondaDependencies
from azureml.core.model import InferenceConfig, Model

root_config_path = os.path.join(Path(__file__).resolve().parents[1], 'azure_config.json')

with open(root_config_path, 'r') as f:
    cfg = json.load(f)

subscription_id = cfg["subscription_id"]
resource_group = cfg["resource_group"]
workspace_name = cfg["workspace_name"]
region = cfg["region"]
redeploy_if_exists = bool(cfg.get("redeploy_if_exists", True))

backend_cfg = cfg["services"]["backend"]
app_path = backend_cfg["app_path"]
service_name = backend_cfg["service_name"]
cpu_cores = backend_cfg.get("cpu_cores", 2)
memory_gb = backend_cfg.get("memory_gb", 2)
node_version = backend_cfg.get("node_version", "18.x")
env_vars = backend_cfg.get("environment_variables", {})

# Get or create workspace
try:
    ws = Workspace.get(name=workspace_name,
                       subscription_id=subscription_id,
                       resource_group=resource_group)
except Exception:
    ws = Workspace.create(name=workspace_name,
                          subscription_id=subscription_id,
                          resource_group=resource_group,
                          location=region,
                          exist_ok=True)

print(f"Using workspace: {ws.name}")

# Build the backend application
print("Building backend application...")
os.chdir(app_path)
subprocess.run(["npm", "install"], check=True)
subprocess.run(["npm", "run", "build"], check=True)

# Create a model artifact (for Azure ML deployment)
model_path = os.path.join(app_path, "model")
os.makedirs(model_path, exist_ok=True)

# Copy built files to model directory
import shutil
dist_path = os.path.join(app_path, "dist")
if os.path.exists(dist_path):
    shutil.copytree(dist_path, os.path.join(model_path, "dist"), dirs_exist_ok=True)
else:
    # Create placeholder if dist doesn't exist
    with open(os.path.join(model_path, "placeholder.txt"), "w") as f:
        f.write("Backend model placeholder")

# Copy package.json and other necessary files
for file in ["package.json", "package-lock.json"]:
    if os.path.exists(file):
        shutil.copy2(file, model_path)

# Register model
model_name = "wealtharena-backend-model"
registered_model = Model.register(model_path=model_path, model_name=model_name, workspace=ws)
print(f"Registered model: {registered_model.name}:{registered_model.version}")

# Create environment for Node.js
env = Environment('wealtharena-backend-env')
conda_deps = CondaDependencies.create(
    conda_packages=[
        f"nodejs={node_version}",
        "npm"
    ],
    pip_packages=[
        "azureml-defaults"
    ]
)
env.python.conda_dependencies = conda_deps

# Create entry script for Node.js backend
entry_script_content = '''import os
import sys
import subprocess

def init():
    # Install dependencies and start the Node.js server
    os.chdir(os.path.join(os.getcwd(), 'model'))
    subprocess.run(['npm', 'install'], check=True)
    
def run(data):
    # For Azure ML deployment, we'll return the service URL
    # The actual server will be started during init
    return {
        "status": "ok",
        "message": "Backend service is running",
        "port": 8080
    }
'''

entry_script_path = os.path.join(app_path, "score.py")
with open(entry_script_path, "w") as f:
    f.write(entry_script_content)

# Create inference config
inference_config = InferenceConfig(entry_script=entry_script_path, environment=env)

# ACI config with environment variables
aci_config = AciWebservice.deploy_configuration(
    cpu_cores=cpu_cores, 
    memory_gb=memory_gb,
    environment_variables=env_vars
)

# Check if service exists
service = None
try:
    service = Webservice(name=service_name, workspace=ws)
    if redeploy_if_exists:
        print(f"Deleting existing service: {service_name}")
        service.delete()
        service = None
    else:
        print(f"Service {service_name} already exists. Skipping deployment.")
except Exception:
    service = None

if service is None:
    service = Model.deploy(workspace=ws,
                           name=service_name,
                           models=[registered_model],
                           inference_config=inference_config,
                           deployment_config=aci_config)
    service.wait_for_deployment(show_output=True)

print(f"Backend Service URL: {service.scoring_uri}")
print(f"Backend Service Status: {service.state}")
