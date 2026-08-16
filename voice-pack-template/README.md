# Japanese voice-pack repository template

Use this directory as the starting point for one voice pack. Create a new
standalone repository from it rather than forking the main app repository.

Required layout:

```text
manifest.json
N5/<word-id>.wav
N4/<word-id>.wav
N3/<word-id>.wav
N2/<word-id>.wav
N1/<word-id>.wav
scripts/build-site.mjs
.github/workflows/deploy-pages.yml
```

Copy `manifest.example.json` to `manifest.json`, fill in the voice metadata and
coverage, then validate locally:

```bash
node scripts/build-site.mjs . _site
```

After pushing, select **GitHub Actions** as the repository's Pages source. The
published pack root is normally:

```text
https://<owner>.github.io/<repository>
```

A private source repository does not make the deployed Pages files private.
True private Pages access control requires an eligible organization on GitHub
Enterprise Cloud, and a public browser app cannot safely embed a GitHub token.
Repository visibility also does not replace permission to use or redistribute
the reference voice, model, or generated audio.
