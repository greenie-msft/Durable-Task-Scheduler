
# Durable Task SDKs JavaScript Sample Specification

## Objective
Create JavaScript samples for each durable function patterns found in the [Durable Task Scheduler sample repo](https://github.com/greenie-msft/Durable-Task-Scheduler/tree/main/samples/durable-task-sdks), matching the structure and functionality of the samples in other languages.

## Requirements

1. **Pattern Coverage**
	- Identify all durable function patterns implemented in other languages (e.g., orchestration, activity, sub-orchestration, fan-out/fan-in, etc.).
	- For each pattern, create an equivalent JavaScript sample that uses the durable task sdk for javascript:https://github.com/microsoft/durabletask-js

2. **Sample Structure**
	- Each sample must include both a client and a worker, following the conventions used in other language samples.
	- Ensure code is modular, well-commented, and easy to understand.

3. **Local Development**
	- Use the Durable Task Scheduler emulator and Azurite for local testing and development.
	- Provide clear setup instructions in a README for each sample, including prerequisites and steps to run locally.

4. **Repository Contribution**
	- Useing the github mcp tool, submit each sample as a pull request to [this repository](https://github.com/greenie-msft/Durable-Task-Scheduler/tree/main/samples/durable-task-sdks).
	- Follow repository contribution guidelines (naming, formatting, documentation).

5. **Documentation**
	- Each sample should include a README explaining:
	  - The pattern demonstrated
	  - How to run the sample locally
	  - Expected behavior and output

6. **Testing**
	- Include basic tests or validation steps to ensure each sample works as intended.

## Deliverables
- JavaScript sample code for each durable function pattern
- README files for each sample
- Pull requests for each sample, following repo guidelines
3. Use the github mcp tool for creating the pull requests for each of the samples