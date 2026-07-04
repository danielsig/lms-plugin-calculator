# Calculator Plugin for LM Studio

An LM Studio plugin that lets LLMs evaluate math expressions using `+`, `-`, `*`, `/`, `^`, parentheses, and JavaScript [`Math` functions and constants](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math).

## Installation

The plugin is available for download on the
[LM Studio Hub](https://lmstudio.ai/danielsig/calculator).

![Click the "Run in LM Studio" button on the Hub page](docs/assets/how_to_install_on_lm_studio_hub.png)

## How to use

Enable the plugin, then ask the model to calculate something using the **Calculator** tool.

The tool returns `{ expression, result }` for valid input, or an error message when the expression cannot be evaluated.
