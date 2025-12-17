import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

interface InitConfig {
  style: string;
  componentPath: string;
  utilsPath: string;
}

export async function init() {
  console.log(chalk.blue('Initializing your project configuration...\n'));

  const configPath = join(process.cwd(), 'components.json');
  if (existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'components.json already exists. Overwrite?',
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('Initialization cancelled.'));
      return;
    }
  }

  const answers = await inquirer.prompt<InitConfig>([
    {
      type: 'list',
      name: 'style',
      message: 'Which framework are you using?',
      choices: [
        { name: 'Next.js', value: 'nextjs' },
        { name: 'React', value: 'react' },
        { name: 'Vue', value: 'vue' },
        { name: 'Angular', value: 'angular' },
      ],
      default: 'nextjs',
    },
    {
      type: 'input',
      name: 'componentPath',
      message: 'Where would you like to install components?',
      default: (answers: any) => {
        if (answers.style === 'nextjs') return 'src/components';
        if (answers.style === 'react') return 'src/components';
        if (answers.style === 'vue') return 'src/components';
        if (answers.style === 'angular') return 'src/app/components';
        return 'src/components';
      },
    },
    {
      type: 'input',
      name: 'utilsPath',
      message: 'Where is your utils file?',
      default: 'src/lib/utils',
    },
  ]);

  const config = {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: answers.style,
    aliases: {
      components: answers.componentPath,
      utils: answers.utilsPath,
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(chalk.green('\n✓ Configuration saved to components.json'));
  console.log(chalk.blue('\nYou can now add components with:'));
  console.log(chalk.cyan('  clipmotion add image-crossfade\n'));
}
