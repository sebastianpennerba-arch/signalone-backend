# SignalOne Meta Backend (Render)

Node/Express Backend für SignalOne.cloud, das den OAuth-Code von Meta
gegen ein Access Token tauscht.

## Endpoints

- `POST /api/meta/oauth/token`
  - Body: `{ "code": "…", "redirectUri": "https://amaschine.vercel.app/" }`

## Dev

```bash
npm install
npm start
