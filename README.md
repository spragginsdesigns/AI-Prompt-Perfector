# AI Prompt Perfector

A tool to enhance and perfect prompts for AI interaction, with a built-in prompt library.

## Setup

1. Clone the repository

```bash
git clone https://github.com/yourusername/AI-Prompt-Perfector.git
cd AI-Prompt-Perfector
```

2. Configure Supabase credentials

```bash
# Copy the example config file
cp config.example.js config.js

# Edit config.js with your Supabase credentials
# Never commit this file to the repository
```

3. Local Development

- Open `index.html` in your browser
- The site will use your local `config.js` settings

## Deployment

For GitHub Pages deployment:

1. Create a deployment branch

```bash
git checkout -b gh-pages
```

2. Update `config.js` with production credentials

```javascript
const config = {
	supabaseUrl: "your-production-url",
	supabaseKey: "your-production-key"
};
```

3. Deploy to GitHub Pages

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

⚠️ **Security Note**: Never commit sensitive credentials to the main branch. The `gh-pages` branch should be treated as public and should only contain the public anon key from Supabase.
