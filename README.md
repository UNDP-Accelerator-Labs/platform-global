=======

# AccLab Global Platform

The live platforms can be accessed via:

https://www.sdg-innovation-commons.org/

This is a Node.js application that uses Express.js for routing and EJS as the view engine. It interacts with two Postgres databases, where one stores shared information like user sessions and credentials, and the other stores information on pads.

## Local Setup

## Getting started

To set up the code locally, follow these steps:

1. Clone the repository.
2. Follow instructions to set up the databases from https://github.com/UNDP-Accelerator-Labs/platform
3. Make sure you have Node.js installed. Use the `node --version` command to check your version.
4. Install the required dependencies using either `npm install` or `yarn install`.
5. Copy `template.env` to `.env` and set the environment variables and the appropriate credentials.
   (If the env file is other than `.env` you can specify the path via
   `ENV=<pathtoenv> make <command>` on all make commands)
6. Update the configuration in `config/edit/index.js` if needed.

## Run the servers

Run:

```
source .env
npm start
```

or

```
make run-web
```

And in another tab (to compile sass):

```
npm run sass
```

Open your browser and navigate to [http://localhost:2000](http://localhost:2000) to access the application.

## Add User

Run:

```
make create-user
```

To interactively insert a user into the login db.

## File Structure

The file structure of this project is organized as follows:

- **views**: Contains all front-end logic and views. The front-end heavily depends on the D3.js library and EJS templating.
- **public**: Contains all static files and styling.
- **routes**: Contains all routing, backend logic, and resource privileges.
- **config**: Contains platform configuration files.
  - **config/db**: Contains database settings.
  - **config/edit**: Contains platform configurable settings.

## Create docker image locally

Run

```
make -s build
```

to build the docker image.
Use `make -s git-check` to verify that the current working copy is clean and
that no unwanted (or uncommit) files will be included in the image.

## Push docker image

Make sure to log in to azure via `make azlogin`.

Run

```
make -s build
make -s dockerpush
```

to build the image and push it to azure. Make sure to update the image in the
Deployment Center. This is only if you need to test non major version changes.
For proper deployment use the deploy functionality as described below.

## Deploying new version

Make sure to be on the main branch with a clean working copy.

Run

```
make -s publish
```
