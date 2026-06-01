# Requirements Document

## Introduction

`portfolio-hardening` turns the Jarvis project — a local, offline-first voice
assistant for macOS (Apple Silicon) written in Python 3.11 — into something that
reads, on GitHub, like a real, active, technically strong indie AI/OSS project.
The target audience is OpenAI / OSS program reviewers and portfolio visitors.

This spec is a sibling to the existing `portfolio-polish` spec. Where
`portfolio-polish` focused on portfolio *artifacts and process recommendations*
(analysis report, profile guide, feature catalog as text), `portfolio-hardening`
is **delivery-oriented**: it specifies the concrete, real deliverables to ship —
documentation files, an English-facing README, demo media, a maintained
`TASKS.md`, a realistic subset of *actually implemented* new features, engineering
quality upgrades (type checking, coverage, badges), and a working release process.

Hard constraint, applied to every requirement: **all activity must be genuine and
reproducible.** No fake commits, no spam PRs, no artificial GitHub activity, no
inflated claims. Every artifact must reflect the real state of the code, and every
"completed" item must correspond to a real change.

Platform reality (corrects a common mistake): Jarvis is a **local desktop daemon
for macOS**, not a web app. There is no React/Vite frontend and no Vercel/web
deployment. A "live demo" means a screen-recorded GIF/video plus screenshots, and
optionally a static GitHub Pages page — never a deployed web service.

Several requirements are scoped as **quick wins** (achievable by a solo developer
in roughly one day): the documentation files (Req 1), the English README pass
(Req 2), `TASKS.md` (Req 5), the CHANGELOG/commit convention (Req 8), and the CI
badge + type-check additions (Req 6). The new code features (Req 4) are larger and
each ships on its own branch.

## Glossary

- **Project**: the Jarvis repository — a Python 3.11+ macOS voice assistant, package
  `src/jarvis`, entry point `python -m jarvis`.
- **Maintainer**: the project author who performs and reviews the changes.
- **README**: the root `README.md` file.
- **Readme_EN**: an English-language README variant (`README.en.md`) or an English
  section within `README.md`, intended for OSS reach.
- **Contributing_Guide**: the root `CONTRIBUTING.md` file describing how to set up,
  branch, commit, and open a pull request.
- **License_File**: the root `LICENSE` file containing the full MIT license text.
- **Demo_Assets**: screen-recorded media (animated GIF and/or video) and screenshots
  that demonstrate Jarvis in use, stored inside the repository.
- **Landing_Page**: an optional static page published via GitHub Pages.
- **Tasks_File**: the root `TASKS.md` file — a living roadmap as a markdown checklist
  with `TODO`, `IN PROGRESS`, and `DONE` sections.
- **Tray_App**: a macOS menu-bar (tray) presence for the assistant, plus a
  LaunchAgent that starts the assistant at login.
- **Offline_Mode**: a configuration in which the LLM brain runs locally via Ollama,
  so the assistant works without any cloud LLM call.
- **Doctor_Command**: a CLI diagnostic subcommand of `python -m jarvis` that reports
  environment and dependency readiness.
- **CI_Pipeline**: the GitHub Actions workflow defined in `.github/workflows/ci.yml`.
- **Type_Checker**: the static type-checking tool integrated into the Project
  (mypy or an equivalent configured for Python 3.11).
- **Test_Suite**: the pytest-based tests under `tests/`.
- **Coverage_Report**: the test-coverage measurement produced when running the
  Test_Suite.
- **Changelog**: the root `CHANGELOG.md` file in Keep a Changelog format using
  Semantic Versioning (SemVer).
- **Commit_Convention**: the Conventional Commits rules documented for the Project.
- **Release_Notes**: the descriptive text published for a GitHub Release.
- **Profile_Guide**: a document of ready-to-use text for the Maintainer's GitHub
  profile and the repository metadata (bio, description, topics, pinned repos).
- **Git_Workflow**: the documented per-feature branch-and-commit process.
- **Quick_Win**: a deliverable a solo Maintainer can complete within one working day.

## Requirements

### Requirement 1: Documentation suite (CONTRIBUTING, LICENSE, contribution path)

**User Story:** As a Maintainer, I want the standard OSS documentation files in
place, so that the Project looks like a maintained open-source project and is easy
to contribute to.

#### Acceptance Criteria

1. THE Project SHALL contain a Contributing_Guide at the repository root.
2. THE Contributing_Guide SHALL document the local setup steps, the Git_Workflow
   branch-and-commit process, and the Commit_Convention.
3. THE Contributing_Guide SHALL link to `docs/SETUP.md` and `docs/SECURITY.md`.
4. THE Project SHALL contain a License_File at the repository root holding the full
   MIT license text and the copyright line naming the Maintainer.
5. WHERE the README references contribution or license, THE README SHALL link to
   the Contributing_Guide and the License_File.
6. THE Contributing_Guide SHALL describe only real, reproducible workflows and SHALL
   exclude any step that creates artificial repository activity.

### Requirement 2: English-facing README for OSS reach

**User Story:** As a Maintainer, I want an English README path alongside the strong
Russian one, so that international OSS and OpenAI reviewers can read the Project.

#### Acceptance Criteria

1. THE Project SHALL provide a Readme_EN that conveys the same content as the
   Russian README: description, features, installation, usage, tech stack, roadmap,
   contribution, and license.
2. THE README SHALL retain Russian as the primary language of `README.md`.
3. THE README SHALL display a language switch link to the Readme_EN at the top of
   the document, and the Readme_EN SHALL display a reciprocal link back to the
   Russian README.
4. THE Readme_EN SHALL describe only capabilities that exist in the Project and
   SHALL NOT state features that are not implemented.
5. WHERE a feature is planned but not implemented, THE Readme_EN SHALL mark it as
   roadmap or planned rather than as a current capability.
6. THE README and the Readme_EN SHALL keep existing internal links to
   `docs/SETUP.md`, `docs/SECURITY.md`, and `docs/ROADMAP.md` valid.

### Requirement 3: Demo and visual assets

**User Story:** As a Maintainer, I want an embedded demo and screenshots, so that a
visitor immediately sees Jarvis working without installing it.

#### Acceptance Criteria

1. THE Project SHALL store Demo_Assets in a dedicated directory under
   `assets/` within the repository.
2. THE Demo_Assets SHALL include at least one animated GIF or video that
   demonstrates the voice loop: wake word, then spoken command, then spoken response.
3. THE README SHALL embed a Demo_Assets preview (GIF or screenshot) within the first
   screen of the document, above the installation section.
4. THE Project SHALL include written instructions, with concrete macOS commands, for
   recording the screen and converting the recording into an embeddable GIF.
5. THE instructions SHALL list the recommended screenshots and the scenario each one
   demonstrates.
6. WHERE a Landing_Page is produced, THE Landing_Page SHALL be published via GitHub
   Pages, SHALL be marked optional, and SHALL NOT require any web-service deployment
   such as Vercel.
7. THE Demo_Assets SHALL depict only real recordings of the Project and SHALL NOT
   contain staged or fabricated functionality.

### Requirement 4: Realistic subset of newly shipped capability features

**User Story:** As a Maintainer, I want a small set of genuinely useful new features
actually implemented, so that the Project demonstrates real technical depth and
recent activity.

#### Acceptance Criteria

1. THE Project SHALL implement a Tray_App that shows a macOS menu-bar item exposing
   at least start/stop listening and quit actions.
2. THE Tray_App SHALL provide a LaunchAgent definition that starts the assistant at
   user login, and SHALL document how to install and uninstall the LaunchAgent.
3. THE Project SHALL implement an Offline_Mode in which the LLM brain runs locally
   through Ollama via the existing OpenAI-compatible client in `brain/openai_llm.py`.
4. WHEN Offline_Mode is selected in `config/config.yaml`, THE Project SHALL route
   brain requests to the local Ollama endpoint and SHALL NOT send command text to a
   cloud LLM provider.
5. IF Offline_Mode is selected but the local Ollama endpoint is unreachable, THEN THE
   Project SHALL report a descriptive error identifying the unreachable endpoint.
6. THE Project SHALL implement a Doctor_Command, invoked as a subcommand of
   `python -m jarvis`, that checks microphone access, the configured brain engine,
   required binaries (such as `ffmpeg`), and `.env` presence, and reports each check
   as pass or fail.
7. THE new features SHALL preserve the existing `python -m jarvis` entry point and
   the existing default behavior when their configuration flags are disabled.
8. Each new feature SHALL be accompanied by tests in the Test_Suite that exercise its
   non-UI logic.

### Requirement 5: Living roadmap in TASKS.md

**User Story:** As a Maintainer, I want a maintained TASKS.md, so that the Project
shows a real, evolving roadmap and tracked progress.

#### Acceptance Criteria

1. THE Tasks_File SHALL contain exactly three sections titled `TODO`, `IN PROGRESS`,
   and `DONE`.
2. THE Tasks_File SHALL represent every task as a markdown checklist item with a
   short description.
3. WHEN a task is completed, THE Maintainer SHALL check its checkbox and move it to
   the `DONE` section with a completion date in `YYYY-MM-DD` format.
4. WHEN a task is completed, THE Tasks_File SHALL surface a suggested next task drawn
   from the `TODO` section.
5. WHILE a task is being worked on, THE Tasks_File SHALL keep that task in the
   `IN PROGRESS` section.
6. THE Tasks_File SHALL reflect only real tasks and their real completion status.
7. THE Tasks_File SHALL stay consistent with `docs/ROADMAP.md` so that the two do not
   contradict each other.

### Requirement 6: Engineering quality — type checking, coverage, and badges

**User Story:** As a Maintainer, I want stronger automated quality gates and visible
status badges, so that the Project signals engineering rigor.

#### Acceptance Criteria

1. THE Project SHALL configure a Type_Checker for Python 3.11 over the `src/jarvis`
   package.
2. THE CI_Pipeline SHALL run the Type_Checker on every push and pull request in
   addition to the existing ruff lint, ruff format check, and pytest steps.
3. THE CI_Pipeline SHALL produce a Coverage_Report when the Test_Suite runs.
4. THE README SHALL display status badges for at least: CI status, Python version,
   and license.
5. WHERE a coverage badge is added, THE coverage value SHALL be derived from the
   real Coverage_Report and SHALL NOT be a hard-coded or fabricated number.
6. WHEN the Type_Checker or the Test_Suite reports an error in CI, THE CI_Pipeline
   SHALL fail the affected job.
7. THE Test_Suite SHALL add tests for at least the new features defined in
   Requirement 4 and SHALL keep all existing tests passing.

### Requirement 7: GitHub presence and repository metadata

**User Story:** As a Maintainer, I want ready-to-use profile and repository metadata,
so that the account and repo look professional without inflated claims.

#### Acceptance Criteria

1. THE Profile_Guide SHALL provide a GitHub profile bio within the 160-character
   limit.
2. THE Profile_Guide SHALL provide a repository description within the 350-character
   limit.
3. THE Profile_Guide SHALL provide between 5 and 20 repository topics formatted as
   valid GitHub topics using lowercase letters, digits, and hyphens.
4. THE Profile_Guide SHALL provide pinned-repository recommendations with an explicit
   ordering.
5. THE Profile_Guide SHALL present every text as a ready-to-copy block.
6. THE Profile_Guide SHALL base all claims on real Project characteristics and SHALL
   exclude any statement that misrepresents the Project.

### Requirement 8: Release process — CHANGELOG, SemVer, and release notes

**User Story:** As a Maintainer, I want a real changelog and release process, so that
the Project looks actively and carefully maintained.

#### Acceptance Criteria

1. THE Changelog SHALL follow the Keep a Changelog format with version headers using
   SemVer.
2. THE Changelog SHALL contain an `Unreleased` section for pending changes.
3. THE Commit_Convention SHALL define Conventional Commits message format with an
   enumerated list of allowed types including at least feat, fix, docs, refactor,
   test, and chore.
4. THE Commit_Convention SHALL include at least five example commit messages drawn
   from real Project tasks.
5. WHEN a release is prepared, THE Release_Notes SHALL be provided as ready-to-use
   markdown that links to the matching Changelog version.
6. WHEN a release is tagged, THE version in `pyproject.toml` SHALL match the released
   SemVer version.
7. THE Changelog SHALL record only changes that were actually made and SHALL exclude
   fictional entries.

### Requirement 9: Per-feature git branch and commit workflow

**User Story:** As a Maintainer, I want a documented per-feature git workflow, so
that the repository history looks clean and professional and every feature is
traceable.

#### Acceptance Criteria

1. WHEN work on a new feature begins, THE Git_Workflow SHALL specify creating a
   dedicated branch named `feature/<kebab-case-name>`.
2. THE Git_Workflow SHALL provide an ordered command sequence: create branch, stage
   changes, commit, and push with upstream tracking.
3. THE Git_Workflow SHALL provide commit messages that conform to the
   Commit_Convention.
4. THE Git_Workflow SHALL provide a CLI command to open a pull request via `gh pr
   create`.
5. THE Git_Workflow SHALL direct pushes to the feature branch rather than directly to
   `main`.
6. IF a command is destructive, such as `push --force` or `reset --hard`, THEN THE
   Git_Workflow SHALL flag it with a warning and SHALL exclude it from the standard
   flow.
7. THE Git_Workflow SHALL present every command as a ready-to-run block with example
   values filled in.
