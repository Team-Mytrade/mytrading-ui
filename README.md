

1. Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```
    > On `npm` some included packages can cause peer-deps issue with React 18 while installing.
    >
    > Use the `--legacy-peer-deps` flag, at the end of the installation command, as a workaround for that.

2. Start the development server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```

3. Json database:
 ```bash
   3.1 Install JSON-Server 
        > npm install -g json-server
   3.2 Start JSON-Server
       >json-server --watch db.json --port 5000
 ```
