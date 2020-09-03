const compareVersions = require('compare-versions');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const fs = require('fs');
const process = require('process');
const chalk = require('chalk');

const gitHubConditions =
`• The documentation (README) contains a description of the project, illustration of the project with a demo or screenshots and a CONTRIBUTING section.
• The project is active and maintained.
• The project accepts contributions.`;

const electronConditions =
`• The Electron app has been created with Quasar.
• The Electron app is original and not too simple.`;

const iOSConditions =
`• The iOS app must be available on the Apple App Store.
• The iOS app has been created with Quasar.
• The iOS app is original and not too simple.`;

const androidConditions =
`• The Android app must be available on the Google Play Store.
• The Android app has been created with Quasar.
• The Android app is original and not too simple.`;

const websitePWAConditions =
`• The website/PWA has been created with Quasar.
• The website/PWA is available without errors or SSL certificate problems, and loads in a reasonable amount of time.
• The website/PWA is original and not too simple.`;

const linkTypeToConditions = {
	'GitHub': gitHubConditions,
	'Electron': electronConditions,
	'iOS': iOSConditions,
	'Android': androidConditions,
	'Website/PWA': websitePWAConditions,
};

const linkTypeToMessage = {
	'Electron':
		"Please provide a link to a website specifically built for your " +
		"Electron app (the website doesn't need to be written with Quasar): ",
	'Android': "Please provide a Google Play Store link to your Android App: ",
	'iOS': "Please provide an App Store link to your iOS app: ",
	'Website': "Please provide a link to your website: ",
	'PWA': "Please provide a link to your PWA: ",
	'GitHub':
		"Please provide a link to the GitHub repository of your project: "
};

(async () => {
	// Retrieving all the possible Quasar versions
	const npmView = exec('npm view quasar versions --json');
	const quasarVersions = await new Promise((resolve, reject) => {
		npmView.stdout.on('data', (data) => {
			resolve(JSON.parse(data).reverse());
		});
	});

	// Prompting for name of project and available links
	const {projectName, linkTypes} = await inquirer.prompt([
		{
			type: 'input',
			name: 'projectName',
			message: "What's your project's name?",
		},
		{
			type: 'checkbox',
			name: 'linkTypes',
			message: 'What types of links does your project have?',
			choices: [
				{name: 'GitHub'},
				{name: 'Website/PWA'},
				{name: 'iOS'},
				{name: 'Android'},
				{name: 'Electron'}
			]
		}
	]);

	// Outputting requirements for each link type and filtering the ones that meet
	// requirements
	const validLinkTypes = [];
	for (const linkType of linkTypes) {
		console.log();
		console.log(chalk.bold(`Conditions for specifying ${
			/aeiou/.test(linkType[0]) ? 'an' : 'a'
		} ${linkType} link:`));
		console.log(linkTypeToConditions[linkType]);
		console.log();
		const { meetsRequirements } = await inquirer.prompt({
			type: 'confirm',
			name: 'meetsRequirements',
			message: `Does your ${linkType} link meet these requirements?`
		});
		if (meetsRequirements === true) {
			validLinkTypes.push(linkType);
		}
	}

	// Querying user for the project's links
	const links = [];
	for (const validLinkType of validLinkTypes) {
		let specificLinkType = validLinkType;
		if (specificLinkType === 'Website/PWA') {
			const { isPWA } = await inquirer.prompt({
				type: 'confirm',
				name: 'isPWA',
				message: 'Is your website a PWA?',
			});
			if (isPWA === true) {
				specificLinkType = 'PWA';
			} else {
				specificLinkType = 'Website';
			}
		}

		const {url} = await inquirer.prompt({
			type: 'input',
			name: 'url',
			message: linkTypeToMessage[specificLinkType],
		});
		links.push({
			name: specificLinkType,
			url,
		});
	}

	// Querying user for a description of their project and the version of Quasar
	// their project is running on
	const {description, version} = await inquirer.prompt([{
		type: 'input',
		name: 'description',
		message: 'Please provide a short description of your project:'
	}, {
		type: 'list',
		name: 'version',
		message: 'Which version of Quasar does your project use?',
		choices: quasarVersions
	}]);

	// Extracting all current projects from README.md - Note: since array indices
	// are 0-based in JavaScript, make sure to add 1 when outputting
	const readmeLines = fs.readFileSync('README.md').toString().trim().split('\n');
	const projectsUsingQuasarLineNumber = readmeLines.indexOf('# Projects Using Quasar');
	const projectSectionLines = readmeLines.slice(projectsUsingQuasarLineNumber);

	// Identifies the table separator (| --- | --- ... etc.) by removing all pipes and spaces
	// and seeing if only dashes (-) remain (and then adds 1 to reach the next line
	// which should be the first project in the list)
	const indexOfFirstProjectInSection = projectSectionLines.findIndex(
		(line) => {
			const lineWithoutPipesAndSpaces = line.split('|').map((section) => section.trim()).join('');
			if (/^-+$/.test(lineWithoutPipesAndSpaces)) {
				return true;
			}
		}
	) + 1;
	const projectLines = projectSectionLines.slice(indexOfFirstProjectInSection);
	const firstProjectLineNumber = projectsUsingQuasarLineNumber + indexOfFirstProjectInSection;

	// Extracting the project version from the markdown
	function extractProjectVersion(projectMd) {
		// Removing the ending pipe
		const trimmedProjectMd = projectMd.replace(/\|+$/, '');
		// Returning the version trimmed of spaces and the trailing plus sign
		return trimmedProjectMd.split('|').pop().trim().replace(/\++$/, '');
	}

	// Getting the versions of all the current projects
	const versionsOfCurrentProjects = projectLines.map(extractProjectVersion);

	// Checking for invalid version numbers and outputting their line numbers
	let invalidVersionFound = false;
	versionsOfCurrentProjects.forEach((version, index) => {
		const isValid = compareVersions.validate(version);

		if (isValid === false) {
			invalidVersionFound = true;
			console.log(`An invalid version number (${version}) was found at line ${firstProjectLineNumber + index + 1}`)
		}
	});

	// Aborting process if an invalid version number is found
	if (invalidVersionFound) {
		console.error('At least one invalid project version was detected, please fix these invalid versions before continuing.');
		process.exit(1);
	}

	// Finding the first version which is less than the added project's version
	indexAdded = versionsOfCurrentProjects.sort(compareVersions).reverse().findIndex(
		(curVersion) => compareVersions.compare(curVersion, version, '<')
	);

	// If none of the projects were older than the current one, (a.k.a. project
	// is the oldest version), set the index added to the total number of projects
	if (indexAdded === -1) {
		indexAdded = versionsOfCurrentProjects.length;
	}

	// Creating the markdown which will be inserted into README.md
	const md = `| ${projectName} | ${links.map(({ name, url }) => `[${name}](${url})`).join(', ')} | ${description} | v${version} |`;

	// Sorting the projects (in case they aren't sorted)
	// Sorting in reverse order so that most projects using most recent Quasar versions appear on top
	projectLines.sort((p1, p2) => {
		const v1 = extractProjectVersion(p1);
		const v2 = extractProjectVersion(p2);

		return compareVersions(v1, v2);
	}).reverse();

	// Writing the output back into README.md with the current project inserted (and the other projects sorted)
	const newReadme = [
		...readmeLines.slice(0, firstProjectLineNumber),
		...projectLines.slice(0, indexAdded),
		md,
		...projectLines.slice(indexAdded)
	].join('\n');
	fs.writeFileSync('README.md', newReadme);

	const lineToAdd = firstProjectLineNumber + indexAdded + 1;
	console.log(`Your project has been added at line ${lineToAdd}. Feel free to make any changes to it in README.md`);
})();
