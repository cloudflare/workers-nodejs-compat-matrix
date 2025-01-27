# Workers Node.js Support

Quick and dirty audit of Node.js support across Workers. See <https://workers-nodejs-compat-matrix.pages.dev>

## Install

Install Volta:

```shell
curl https://get.volta.sh | bash
```

Install Deno:

```shell
# see https://docs.deno.com/runtime/manual/getting_started/installation for alternatives
brew install deno
```

Install Bun:

```shell
# see https://bun.sh/docs/installation for alternatives
brew install oven-sh/bun/bun
```

Install the dependencies

```shell
pnpm install
```

## Generate the report

> [!IMPORTANT]
> Update Bun and Deno, i.e. using `brew upgrade`on mac.
> Update `wrangler` and `workerd` in `pnpm-workspace.yaml` from wrangler's [package.json](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/package.json)

> [!IMPORTANT]
> This requires features from Node v22, so if it isn't your default node version, run it with `volta run --node 22 pnpm generate`.

- Update the catalog version in `pnpm-workspace.yaml`

- Run:

  ```shell
  pnpm update -r
  ```

- Generate the report

  ```shell
  node --run generate
  ```

## Serve a local version of the report

```shell
node --run report:dev
```
