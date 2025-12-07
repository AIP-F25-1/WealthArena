"""Utility script for environment bootstrapping on Windows."""

from __future__ import annotations

import argparse
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from importlib import metadata
from packaging.requirements import Requirement
from packaging.utils import canonicalize_name


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap project runtime environment.")
    parser.add_argument("--environment-file", type=Path, default=Path("environment.yml"))
    parser.add_argument("--requirements-file", type=Path, default=Path("requirements.txt"))
    parser.add_argument("--venv-dir", type=Path, default=Path(".venv"))
    parser.add_argument("--force", action="store_true", help="Recreate environments even if they already exist.")
    parser.add_argument(
        "--no-conda",
        action="store_true",
        help="Skip conda environment creation even if conda is available.",
    )
    parser.add_argument(
        "--skip-heavy",
        action="store_true",
        help="Defer installation of heavy packages (ray, torch, transformers) to a later manual step.",
    )
    parser.add_argument(
        "--conda-timeout",
        type=int,
        default=1200,
        help="Abort conda environment creation if it exceeds this many seconds and fall back to virtualenv.",
    )
    return parser.parse_args()


def _normalize_version(version: str) -> str:
    match = re.match(r"^\s*(\d+)\.(\d+)", version)
    if not match:
        raise ValueError(f"Unsupported Python version format: {version!r}")
    return f"{match.group(1)}.{match.group(2)}"


def _detect_python_requirement(requirements_file: Path, environment_file: Path) -> str | None:
    if requirements_file.exists():
        for line in requirements_file.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*python\s*==\s*([\d\.]+)(?:\.\*)?\s*$", line, flags=re.IGNORECASE)
            if match:
                return _normalize_version(match.group(1))
    if environment_file.exists():
        for raw_line in environment_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if line.lower().startswith("python="):
                return _normalize_version(line.split("=", 1)[1])
    return None


def _run_and_capture(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def _find_python_interpreter(required_version: str | None) -> Path:
    if not required_version:
        return Path(sys.executable)

    required_version = _normalize_version(required_version)
    current_version = f"{sys.version_info.major}.{sys.version_info.minor}"

    # Prefer py launcher resolution even when the current interpreter already matches.
    logger.info("Attempting to locate Python %s interpreter.", required_version)

    py_launcher = shutil.which("py")
    if py_launcher:
        try:
            result = _run_and_capture([py_launcher, f"-{required_version}", "-c", "import sys; print(sys.executable)"])
            candidate = Path(result.stdout.strip())
            if candidate.exists():
                logger.info("Resolved Python %s via py launcher at %s", required_version, candidate)
                return candidate
        except subprocess.CalledProcessError:
            logger.debug("py launcher could not locate Python %s", required_version)

    if required_version == current_version:
        current_path = Path(sys.executable)
        if current_path.exists():
            logger.info("Using current interpreter at %s for Python %s", current_path, required_version)
            return current_path

    env_var = os.environ.get(f"PYTHON{required_version.replace('.', '')}_HOME")
    if env_var:
        candidate = Path(env_var) / "python.exe"
        if candidate.exists():
            logger.info("Resolved Python %s via environment variable at %s", required_version, candidate)
            return candidate

    search_roots = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python",
        Path(os.environ.get("ProgramFiles", "")) / "Python",
        Path("C:/Python"),
    ]
    suffix = f"Python{required_version.replace('.', '')}"
    for root in search_roots:
        if not root:
            continue
        candidate = root / suffix / "python.exe"
        if candidate.exists():
            logger.info("Resolved Python %s at %s", required_version, candidate)
            return candidate

    raise RuntimeError(
        (
            f"Python {required_version} is required but was not found. Install it from https://www.python.org/downloads/"
            f" or install Python via `py -{required_version}` if available, then rerun the setup script. "
            f"If the required interpreter is already installed, ensure the Windows 'py' launcher is registered "
            f"with `py -{required_version} -V`."
        )
    )


def _extract_python_version(python_executable: Path) -> str | None:
    try:
        result = _run_and_capture(
            [str(python_executable), "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"]
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return result.stdout.strip()


def _diagnose_failure(stdout: str, stderr: str) -> tuple[str, list[str]]:
    combined = "\n".join(part for part in (stdout, stderr) if part)
    lines = combined.splitlines()
    tail = "\n".join(lines[-25:]) if lines else ""
    hints: list[str] = []

    lowered = combined.lower()
    if "no matching distribution found for finrl" in lowered:
        hints.append(
            "Package 'finrl' version not found. The project requires finrl==0.3.7 "
            "(latest release currently on PyPI for Python 3.10)."
        )
    if "no matching distribution found for mlfinlab" in lowered:
        hints.append(
            "Package 'mlfinlab' is no longer available on PyPI. Hudson & Thames removed it "
            "from public distribution. Comment out or remove mlfinlab from requirements.txt."
        )
    if "no matching distribution found for riskfolio-lib" in lowered:
        hints.append(
            "Package 'riskfolio-lib' version not found. Available versions on PyPI: "
            "0.x.x through 7.0.1. Update requirements.txt to use a valid version like "
            "riskfolio-lib==5.0.1 for Python 3.10 compatibility."
        )
    if "no matching distribution found for sphinx" in lowered or "sphinx==8." in lowered:
        hints.append(
            "Package 'sphinx' 8.x requires Python 3.11+. For Python 3.10, use sphinx==7.4.7 "
            "(latest 7.x release). Also update myst-parser to 3.0.1 for compatibility."
        )
    if "langsmith" in lowered and "requires" in lowered and "0.0.52" in lowered:
        hints.append(
            "langchain 0.0.332 depends on langsmith>=0.0.52. Update requirements.txt to "
            "pin langsmith==0.0.63 (Python 3.10 compatible) or remove the explicit pin."
        )
    if "requires-python" in lowered and ("3.11" in lowered or "3.10" in lowered):
        hints.append(
            "Some dependencies restrict the supported Python versions. Ensure the virtual "
            "environment uses Python 3.10 (as pinned in environment.yml), or adjust "
            "package pins to versions compatible with your Python version."
        )
    if "certificate_verify_failed" in lowered or "ssl: certificate" in lowered:
        hints.append(
            "SSL/TLS handshake failed. Configure corporate/intercepting certificates or run "
            "`pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org ...`. "
            "See docs/troubleshooting.md#ssl-errors."
        )
    if "microsoft visual c++" in lowered or "build tools" in lowered:
        hints.append(
            "Compilation failed due to missing Microsoft C++ Build Tools. Install the latest "
            "Build Tools for Visual Studio and rerun, or prefer the conda environment on Windows."
        )
    if "cp311" in combined and "cp310" in combined:
        hints.append(
            "Wheel compatibility mismatch detected (cp311 vs cp310). Recreate the environment with "
            "Python 3.10 and reinstall dependencies."
        )
    if "pip is looking at multiple versions" in lowered or "backtracking" in lowered:
        hints.append(
            "pip resolver backtracking indicates version conflicts. Try `python scripts/setup_environment.py --skip-heavy` "
            "and install the heavy packages separately after resolving pins. See docs/troubleshooting.md#dependency-conflicts."
        )

    return tail, hints


def run_command(
    cmd: list[str],
    description: str | None = None,
    *,
    timeout: int | None = None,
) -> None:
    label = description or "Command"
    logger.info("Running command: %s", " ".join(cmd))
    try:
        completed = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"Executable not found while running: {' '.join(cmd)}") from exc
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        stderr = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        tail, hints = _diagnose_failure(stdout, stderr)
        details: list[str] = [
            f"{label} timed out after {timeout} seconds.",
            "Full command: " + " ".join(cmd),
        ]
        if tail:
            details.append("---- command output (last 25 lines) ----")
            details.append(tail)
        if hints:
            details.append("---- suggested next steps ----")
            details.extend(hints)
        raise RuntimeError("\n".join(details)) from exc
    except subprocess.CalledProcessError as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        tail, hints = _diagnose_failure(stdout, stderr)
        details: list[str] = [
            f"{label} failed with exit code {exc.returncode}.",
            "Full command: " + " ".join(cmd),
        ]
        if tail:
            details.append("---- command output (last 25 lines) ----")
            details.append(tail)
        if hints:
            details.append("---- suggested next steps ----")
            details.extend(hints)
        raise RuntimeError("\n".join(details)) from exc
    else:
        stdout = completed.stdout.strip() if completed.stdout else ""
        stderr = completed.stderr.strip() if completed.stderr else ""
        if stdout:
            logger.debug("%s stdout:\n%s", label, stdout)
        if stderr:
            logger.debug("%s stderr:\n%s", label, stderr)


def conda_available() -> bool:
    return shutil.which("conda") is not None


def ensure_venv(
    venv_dir: Path,
    base_python: Path,
    required_version: str | None,
    force: bool,
) -> Path:
    normalized_required = _normalize_version(required_version) if required_version else None
    venv_resolved = venv_dir.resolve()
    try:
        base_python_resolved = base_python.resolve()
    except FileNotFoundError:
        base_python_resolved = base_python

    def _is_inside(child: Path, parent: Path) -> bool:
        try:
            child.relative_to(parent)
            return True
        except ValueError:
            return False

    if _is_inside(base_python_resolved, venv_resolved):
        required_hint = normalized_required or f"{sys.version_info.major}.{sys.version_info.minor}"
        raise RuntimeError(
            "Detected that the setup script is running from the target virtual environment "
            f"({venv_resolved}). Activate a system Python interpreter (e.g. `py -{required_hint}`) "
            "or run the script from outside the virtual environment so it can recreate .venv cleanly."
        )

    if venv_dir.exists() and force:
        logger.info("Removing existing virtual environment at %s", venv_dir)
        shutil.rmtree(venv_dir, ignore_errors=True)

    if venv_dir.exists():
        logger.info("Using existing virtual environment at %s", venv_dir)
    else:
        logger.info("Creating virtual environment at %s using %s", venv_dir, base_python)
        run_command([str(base_python), "-m", "venv", str(venv_dir)], description="create virtual environment")

    if os.name == "nt":
        python_path = venv_dir / "Scripts" / "python.exe"
    else:
        python_path = venv_dir / "bin" / "python"

    if not python_path.exists():  # pragma: no cover - sanity safeguard
        raise RuntimeError(f"Python executable not found in virtual environment: {python_path}")

    if normalized_required:
        actual_version = _extract_python_version(python_path)
        if actual_version != normalized_required:
            logger.warning(
                "Virtual environment at %s uses Python %s but %s is required. Recreating environment.",
                venv_dir,
                actual_version or "<unknown>",
                normalized_required,
            )
            shutil.rmtree(venv_dir, ignore_errors=True)
            logger.info("Recreating virtual environment at %s using %s", venv_dir, base_python)
            run_command([str(base_python), "-m", "venv", str(venv_dir)], description="recreate virtual environment")
            if os.name == "nt":
                python_path = venv_dir / "Scripts" / "python.exe"
            else:
                python_path = venv_dir / "bin" / "python"
            actual_version = _extract_python_version(python_path)
            if actual_version != normalized_required:
                raise RuntimeError(
                    f"Failed to provision a Python {normalized_required} virtual environment. "
                    f"Interpreter reported version {actual_version or '<unknown>'}. Ensure the required Python "
                    "runtime is installed and accessible via PATH or the py launcher."
                )

    return python_path
def install_requirements(
    python_executable: Path,
    requirements_file: Path,
    *,
    skip_heavy: bool = False,
) -> None:
    if not requirements_file.exists():
        logger.warning("Requirements file %s not found; skipping pip installation.", requirements_file)
        return

    run_command(
        [str(python_executable), "-m", "pip", "install", "--upgrade", "pip"],
        description="upgrade pip",
    )

    with requirements_file.open("r", encoding="utf-8") as original:
        lines = original.readlines()

    try:
        installed_packages = {
            canonicalize_name(dist.metadata["Name"]): dist.version
            for dist in metadata.distributions()
        }
    except Exception:  # pragma: no cover - defensive
        installed_packages = {}

    filtered_lines: list[str] = []
    deferred_torch_packages: list[str] = []
    heavy_packages_skipped: list[str] = []
    windows_manual_packages: list[str] = []
    heavy_roots = {"ray", "torch", "torchvision", "torchaudio", "transformers"}
    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("python=="):
            logger.info("Skipping interpreter pin in requirements: %s", stripped)
            continue
        if stripped.startswith("torch") or stripped.startswith("torchvision") or stripped.startswith("torchaudio"):
            logger.info("Deferring installation of %s", stripped)
            deferred_torch_packages.append(stripped)
            continue
        base_entry = stripped.split("#", 1)[0].strip()
        if not base_entry:
            continue
        requirement_token = base_entry.split(";", 1)[0].strip()
        normalized_name = requirement_token.split("==", 1)[0].split("[", 1)[0].lower()

        skip_due_to_existing = False
        if requirement_token:
            try:
                requirement = Requirement(requirement_token)
                canon = canonicalize_name(requirement.name)
                installed_version = installed_packages.get(canon)
                if installed_version and requirement.specifier.contains(installed_version, prereleases=True):
                    logger.info(
                        "Requirement %s already satisfied with version %s; skipping reinstall.",
                        requirement_token,
                        installed_version,
                    )
                    skip_due_to_existing = True
            except Exception:
                pass

        if skip_due_to_existing:
            continue
        if skip_heavy and normalized_name in heavy_roots:
            logger.warning("Skipping heavy package %s due to --skip-heavy flag.", stripped)
            heavy_packages_skipped.append(stripped)
            continue
        if os.name == "nt" and normalized_name in {"ta-lib", "ta_lib"}:
            logger.warning(
                "Skipping %s during pip installation on Windows. Refer to docs/troubleshooting.md#ta-lib-and-cvxpy-on-windows "
                "for manual installation guidance or use the conda environment.",
                stripped,
            )
            windows_manual_packages.append(stripped)
            continue
        filtered_lines.append(line)

    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", suffix=".txt") as tmp:
        tmp.writelines(filtered_lines)
        tmp_path = Path(tmp.name)

    try:
        run_command(
            [str(python_executable), "-m", "pip", "install", "-r", str(tmp_path)],
            description=f"install requirements from {requirements_file.name}",
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    if deferred_torch_packages:
        normalized_packages = []
        for spec in deferred_torch_packages:
            base = spec.split("#", 1)[0].strip()
            if "==" in base:
                name, version = base.split("==", 1)
                version = version.split("+", 1)[0]
                normalized_packages.append(f"{name}=={version}")
            else:
                normalized_packages.append(base)
        logger.info(
            "Installing deferred PyTorch packages with CPU wheels: %s",
            ", ".join(normalized_packages),
        )
        run_command(
            [
                str(python_executable),
                "-m",
                "pip",
                "install",
                "--extra-index-url",
                "https://download.pytorch.org/whl/cpu",
            ]
            + normalized_packages,
            description="install deferred PyTorch packages",
        )
    if windows_manual_packages:
        logger.warning(
            "The following packages were not installed automatically: %s. "
            "Install them via conda or download pre-built wheels. See docs/troubleshooting.md#ta-lib-and-cvxpy-on-windows.",
            ", ".join(windows_manual_packages),
        )
    if heavy_packages_skipped:
        logger.info(
            "Deferred heavy packages due to --skip-heavy: %s. Re-run the setup without --skip-heavy or install them later with "
            "`%s -m pip install %s`.",
            ", ".join(heavy_packages_skipped),
            python_executable,
            " ".join(heavy_packages_skipped),
        )


def main() -> None:
    args = parse_args()
    required_python = _detect_python_requirement(args.requirements_file, args.environment_file)
    base_python = _find_python_interpreter(required_python)

    conda_env_name = "agentic-rl-trading"
    using_conda = False
    if conda_available() and not args.no_conda:
        if args.environment_file.exists():
            try:
                if args.force:
                    run_command(
                        ["conda", "env", "remove", "-n", conda_env_name, "-y"],
                        description="remove existing conda environment",
                    )
                run_command(
                    ["conda", "update", "-n", "base", "-c", "defaults", "conda", "-y"],
                    description="update base conda",
                    timeout=args.conda_timeout,
                )
                run_command(
                    [
                        "conda",
                        "env",
                        "create",
                        "-n",
                        conda_env_name,
                        "--file",
                        str(args.environment_file),
                        "--verbose",
                    ],
                    description="create conda environment from environment.yml",
                    timeout=args.conda_timeout,
                )
            except RuntimeError as exc:
                logger.warning(
                    "Conda environment creation failed or exceeded the timeout. Falling back to virtualenv.\n%s",
                    exc,
                )
            else:
                logger.info("Conda environment setup complete. Activate it with: conda activate %s", conda_env_name)
                logger.info(
                    "On Windows, TA-Lib and cvxpy install most reliably via conda. See docs/troubleshooting.md#ta-lib-and-cvxpy-on-windows."
                )
                using_conda = True
        else:
            logger.warning(
                "Conda detected but environment file %s missing. Falling back to virtual environment.",
                args.environment_file,
            )

    if using_conda:
        try:
            result = _run_and_capture(
                ["conda", "run", "-n", conda_env_name, "python", "-c", "import sys; print(sys.executable)"]
            )
            conda_python = Path(result.stdout.strip())
        except subprocess.CalledProcessError as exc:  # pragma: no cover - defensive
            raise RuntimeError(
                "Conda environment was created but the Python executable path could not be determined."
            ) from exc
        install_requirements(conda_python, args.requirements_file, skip_heavy=args.skip_heavy)
        return

    python_executable = ensure_venv(
        args.venv_dir,
        base_python=base_python,
        required_version=required_python,
        force=args.force,
    )
    install_requirements(python_executable, args.requirements_file, skip_heavy=args.skip_heavy)
    logger.info("Virtual environment ready at %s", args.venv_dir.resolve())


if __name__ == "__main__":
    main()
