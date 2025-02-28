![Pronote Desktop](./src/assets/pronotedesktop-banner.png)
# THIS PROJECT IS **NOT** AFFILIATED WITH INDEX-EDUCATION.
# Pronote Desktop

PronoteDesktop is a application designed to pronote with ease, no need to log back into your ENT every single time, this application will log you automatically after entering your logins the first time.

## Features

- automatically log you to your account
- Saving times, just having to start the application instead of going to your web browser, going to your ENT, enter your logins and then access your pronote 

## Download

Visit the [releases](https://github.com/NaosV1/pronote-desktop/releases) page and download the version that suits you.
- [x] MacOS Intel (.dmg)
- [x] MacOS Apple (arm64 .dmg)
- [x] Linux (.AppImage)
- [x] Windows (.exe)

## Fork the project

**Assuming you have electron installed**

1. Clone the repository:
    ```bash
    git clone https://github.com/NaosV1/pronote-desktop.git
    ```
2. Navigate to the project directory:
    ```bash
    cd pronote-desktop
    ```
3. Install the required dependencies:
    ```bash
    npm install
    ```
4. Build the app:
    ```bash
    npm run build:<dist> # npm run build:mac for macos

    npm run build:mac # Build for MacOS
    npm run build:win # Build for Windows
    npm run build:linux # Build for Linux
    ```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.