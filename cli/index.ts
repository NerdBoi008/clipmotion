#!/usr/bin/env node

import { Command } from "commander";
import { addComponent } from "./commands/add.js";
import { buildRegistry } from "./commands/registry-build.js";
import { init } from "./commands/init.js";
import { findComponent } from "./commands/find.js";
import { createComponent } from "./commands/create.js";

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
  .option("-d, --debug", "enable debug logs")
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
  .command("find")
  .description("Find animation by video URL (Instagram, TikTok, YouTube)")
  .argument("<video-url>", "URL of the video containing the animation")
  .option("-d, --debug", "enable debug logs")
  .option("-i, --install", "install component immediately after finding")
  .option("-o, --overwrite", "overwrite existing files")
  .option("-c, --cwd <cwd>", "working directory", process.cwd())
  .action(findComponent);

program
  .command("create")
  .description("Create a new component for contribution (for contributors)")
  .argument("<component-name>", "name of the component (kebab-case)")
  .option("-f, --framework <framework>", "framework (nextjs, react, vue, angular)")
  .option("-v, --video-url <url>", "source video URL")
  .option("-d, --description <desc>", "component description")
  .option("--category <category>", "component category")
  .option("--difficulty <level>", "difficulty level (easy, medium, hard)")
  .option("--debug", "enable debug logs")
  .action(createComponent);

program
  .command("registry:build")
  .description("Build registry JSON files from component source files")
  .action(buildRegistry);

program.parse();
