# __TITLE__

Made from `templates/project` (`node scripts/new-project.mjs __SLUG__ "__TITLE__"`).

```bash
npm install
npm run dev
```

`hub.json` lists it in the hub; `npm run build` writes `dist/`, which
`node scripts/build-projects.mjs __SLUG__` copies to `apps/hub/public/p/__SLUG__/`.
