# Klingelbeek Viewer

Browser-based 3D viewer for the Klingelbeek M + E projects. Shows the full model (Rendered
view) or just the wooden frame + steel columns + foundation (Construction view). Click a
camera chip to fly to that Blender camera and overlay the matching render. Works on desktop
and mobile.

## Folder layout

```
Viewer/
├── index.html           Main page
├── style.css            All styles
├── middleware.js        Vercel Edge Middleware — password gate on deploy
├── package.json         npm scripts + three.js dep
├── vite.config.js       Dev / build config
├── public/              Static files served as-is at the site root
│   ├── model.glb        The exported Blender model
│   └── renders/         All render images (base + Green)
└── src/
    ├── main.js          Scene, renderer, controls, UI wiring
    ├── materials.js     Material color / roughness / metalness overrides
    ├── modes.js         Rendered / Construction toggle (UI only)
    ├── visibility.js    Central scene-visibility composer
    ├── building.js      M / E / Both building selector
    ├── construction.js  Construction-step toggles (main, floor, walls, frames, ceiling)
    ├── cameras.js       Camera chips, render-number mapping, fly-to
    ├── anim.js          Tiny tween helper
    └── tuner.js         Live material tuner (open from the cog in the panel)
```

## Dev

```
npm install
npm run dev
```

Vite prints a local URL and a LAN URL (phone on same Wi-Fi).

## Build a deployable copy

```
npm run build
```

Static files land in `dist/`. Any static host works (Vercel used here).

## Deploy / password gate

The site is deployed to Vercel from this repo. `middleware.js` is a Vercel Edge
Middleware that puts an HTTP Basic Auth prompt in front of every request — enter any
username and the project password to get in. Change the password by editing
`middleware.js` and redeploying.

## Updating things

- **New renders** → drop the files into `public/renders/` using the existing
  naming (`20260909_NNNN.jpg` for base, `20260910_Green_NNNN.jpg` for Green).
  Point a camera at the new number by editing `src/cameras.js` → `RENDER_MAP`.
- **New model** → re-export the Blender file as `public/model.glb`
  (Draco compression on, hierarchy preserved, GPU instancing on, apply modifiers on,
  export full collection hierarchy on).
- **Tune a material** → open the viewer, click the cog in the bottom panel, adjust
  color/roughness/metalness live, click **Copy JSON** and paste the values into
  `src/materials.js`.
- **Change the password** → edit `PASSWORD` in `middleware.js`, commit, push; Vercel
  redeploys automatically.
