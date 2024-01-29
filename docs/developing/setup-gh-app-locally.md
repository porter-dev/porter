# Setup GitHub App Locally

1. Follow the instructions from https://docs.porter.run/docs/github#setting-up-github-repository-integrations (Only from the `Setting Up Github Repository Integrations` section)
2. You'll need to get a public URL for your locally running service. To do this, you can use [Tunnelmole](https://github.com/robbie-cahill/tunnelmole-client), an open source tunneling tool.
   - First install Tunnelmole with one of the following methods:
     - NPM: `npm install -g tunnelmole`
     - Linux: `curl -s https://tunnelmole.com/sh/install-linux.sh | sudo bash`
     - Mac:  `curl -s https://tunnelmole.com/sh/install-mac.sh --output install-mac.sh && sudo bash install-mac.sh`
     - Windows: Install with NPM, or download the `exe` file for Windows [here](https://tunnelmole.com/downloads/tmole.exe) and put it somewhere in your PATH.
   - Then run `tmole 8080`

```
➜  ~ tmole 8000
http://bvdo5f-ip-49-183-170-144.tunnelmole.net is forwarding to localhost:8000
https://bvdo5f-ip-49-183-170-144.tunnelmole.net is forwarding to localhost:8000   
```
   - Alternatively to use `ngrok`, a popular closed source tunneling tool, first [download the binary for your platform])(https://ngrok.com/download) then run `ngrok http 8080`
```
➜  ~ ngrok http 8080
Forwarding http://a7af-103-98-78-24.ngrok.io -> http://localhost:8080
```
4. Open the GitHub app settings by going to https://github.com/settings/apps and select the app you created in step 1 by clicking the `Edit` button.
5. Go to the `Webhook` section and update the `Webhook URL` to `<generated tunnelmole or ngrok domain in step 3>/api/integrations/github-app/webhook`. So in the case of the above Tunnelmole example, it will be `https://bvdo5f-ip-49-183-170-144.tunnelmole.net/api/integrations/github-app/webhook`
6. Open your local Porter instance by going to `http://localhost:8081` and you should now be able to now install your own GitHub app!
