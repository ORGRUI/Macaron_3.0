# Live2D Models

Put browser-loadable Live2D Cubism models in this directory.

Expected structure:

```text
public/live2d-models/ModelName/
  ModelName.model3.json
  ModelName.moc3
  textures...
  expressions/*.exp3.json
  motions/*.motion3.json
  ModelName.physics3.json
```

The active model is configured in `src/data/live2d.ts`.
