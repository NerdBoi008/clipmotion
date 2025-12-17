#!/usr/bin/env node

import { Command } from "commander";
import { addComponent } from "./commands/add.js";
import { buildRegistry } from "./commands/registry-build.js";
import { init } from "./commands/init.js";

const program = new Command();

program
  .name("clipmotion")
  .description("CLI to add animation components from video clips")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize your project configuration")
  .action(init);

program
  .command("add")
  .description("add a component to your project")
  .argument("[components...]", "names, url or local path to component")
  .option("-y, --yes", "skip confirmation prompt")
  .option("-o, --overwrite", "overwrite existing files")
  .option("-c, --cwd <cwd>", "working directory", process.cwd())
  .option("-a, --all", "add all components")
  .option("-p, --path <path>", "target path")
  .option("-s, --silent", "mute output")
  .option("--src-dir", "use src directory", false)
  .option("--css-variables", "use css variables", true)
  .action(addComponent);

program
  .command("registry:build")
  .description("Build registry JSON files from component source files")
  .action(buildRegistry);

program.parse();
