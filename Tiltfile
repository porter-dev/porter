load('ext://restart_process', 'docker_build_with_restart')

secret_settings(disable_scrub=True)

if not os.path.exists("vendor"):
    local(command="go mod vendor")

if config.tilt_subcommand == "up":
    local(command="cd dashboard; npm i --legacy-peer-deps")

if config.tilt_subcommand == "down":
    local(command="rm -rf vendor")
    local(command="rm -rf dashboard/node_modules")

## Build binary locally for faster devexp
local_resource(
  'porter',
  '''GOWORK=off CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -mod vendor -gcflags '-N -l' -o ./porter ./cmd/app/main.go''',
  deps=[
    "api",
    "build",
    "cli",
    "ee",
    "internal",
    "pkg",
  ],
  resource_deps=["postgresql"],
  labels=["porter"]
)

docker_build_with_restart(
    ref="porter1/porter-server",
    context=".",
    dockerfile="zarf/docker/Dockerfile.server.tilt",
    # entrypoint='dlv --listen=:40000 --api-version=2 --headless=true --log=true exec /porter/bin/app',
    entrypoint='/app/porter',
    build_args={},
    only=[
        "porter",
    ],
    live_update=[
        sync('./porter', '/app/'),
    ]
) 

# Frontend
local_resource(
    name="porter-dashboard",
    serve_cmd="npm start",
    serve_dir="dashboard",
    serve_env={
        "NODE_ENV":"development",
        "DEV_SERVER_PORT":"8081",
        "ENABLE_PROXY":true,
        "API_SERVER":"http://localhost:8080"
    }
    resource_deps=["postgresql"],
    labels=["porter"]
)

allow_k8s_contexts('kind-porter')

cluster = str(local('kubectl config current-context')).strip()
if (cluster.startswith("kind-")):
    install = kustomize('zarf/helm', flags=["--enable-helm"])
    decoded = decode_yaml_stream(install)
    for d in decoded:
        if d.get('kind') == 'Deployment':
            if "securityContext" in d['spec']['template']['spec']:
                d['spec']['template']['spec'].pop('securityContext')
            for c in d['spec']['template']['spec']['containers']:
                if "securityContext" in c:
                    c.pop('securityContext')

    updated_install = encode_yaml_stream(decoded)
    k8s_yaml(updated_install)
    k8s_resource(workload='porter-server-web', port_forwards="8080:8080", labels=["porter"])
    # k8s_resource(workload='porter-dashboard-web', port_forwards="8081:8081", labels=["porter"], resource_deps=["postgresql"])
else:
    local("echo 'Be careful that you aren't connected to a staging or prod cluster' && exit 1")
    exit()
