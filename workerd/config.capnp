using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ ( name = "main", worker = .worker ) ],
  sockets = [ ( name = "http", http = (), service = "main" ) ]
);

const worker :Workerd.Worker = (
  modules = [
    ( name = "worker.mjs", esModule = embed "worker.mjs" ),
    ( name = "dump-utils.mjs", esModule = embed "../dump-utils.mjs" )
  ],
  bindings = [
    ( name = "baseline", json = embed "../data/baseline.json" )
  ],
  compatibilityDate = "2025-09-02",
  compatibilityFlags = ["nodejs_compat"]
);
