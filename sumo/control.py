# control.py — robust baseline (no hard-coded 'passenger')
import os, sys, random, csv
from pathlib import Path

# ---- SUMO / TraCI setup ----
SUMO_HOME = os.environ.get("SUMO_HOME")
if not SUMO_HOME:
    raise EnvironmentError(
        'SUMO_HOME not set. Example:\n'
        '  setx SUMO_HOME "C:\\Program Files (x86)\\Eclipse\\Sumo"\n'
        'Then open a NEW terminal.'
    )
TOOLS_DIR = os.path.join(SUMO_HOME, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.append(TOOLS_DIR)

import traci  # type: ignore
import sumolib  # type: ignore

SUMO_BINARY = os.environ.get("SUMO_BINARY", "sumo")   # set to sumo-gui to watch
CFG = "config.sumocfg"

NET_FILE = "network.net.xml"
ROUTE_FILE = "routes.rou.xml"   # will be used via config unless you pass --route-files in sumo_cmd
OUTPUT_CSV = "ev_baseline.csv"

EV_ID = "ev0"
EV_DEPART_TIME = 60.0
KEEP_ALIVE_BUFFER = 3600.0
MAX_SIM_TIME = 3 * 3600.0

def pick_far_edges(net):
    edges = [e for e in net.getEdges() if e.getSpeed() > 0 and e.allows("passenger")]
    if len(edges) < 2:
        edges = [e for e in net.getEdges() if e.getSpeed() > 0]
    if len(edges) < 2:
        raise RuntimeError("Not enough usable edges in the network.")
    best_pair, best_len = None, -1.0
    for _ in range(300):
        a, b = random.sample(edges, 2)
        try:
            route = sumolib.route.compute_shortest_path(a, b, "length")
            if route and route.length > best_len:
                best_pair, best_len = (a, b), route.length
        except Exception:
            continue
    if not best_pair:
        best_pair = random.sample(edges, 2)
    return best_pair[0].getID(), best_pair[1].getID()

def choose_base_vtype():
    vtypes = traci.vehicletype.getIDList()
    if vtypes:
        return vtypes[0]  # use whatever exists in routes (e.g., 'type0')
    # last-resort fallback that SUMO always accepts
    return "DEFAULT_VEHTYPE"

def main():
    # sanity: ensure route file exists so there are background cars
    if not Path(ROUTE_FILE).exists():
        print(f"WARNING: '{ROUTE_FILE}' not found. Make sure you generated routes with randomTrips.py.")

    net = sumolib.net.readNet(NET_FILE)
    src_edge_id, dst_edge_id = pick_far_edges(net)

    sumo_cmd = [SUMO_BINARY, "-c", CFG, "--start"]
    traci.start(sumo_cmd)

    ev_departed = False
    ev_depart_time = None
    ev_arrival_time = None
    must_run_until = EV_DEPART_TIME + KEEP_ALIVE_BUFFER

    try:
        while True:
            traci.simulationStep()
            sim_time = traci.simulation.getTime()

            # spawn EV
            if (not ev_departed) and sim_time >= EV_DEPART_TIME:
                base_type = choose_base_vtype()

                # compute a route using an existing type
                try:
                    fr = traci.simulation.findRoute(src_edge_id, dst_edge_id, vType=base_type)
                    route_edges = fr.edges if (fr and fr.edges) else [src_edge_id, dst_edge_id]
                except Exception:
                    route_edges = [src_edge_id, dst_edge_id]

                # create an EV type by copying whatever base type exists; if copy fails, just use base_type
                ev_type = "evType"
                if ev_type not in traci.vehicletype.getIDList():
                    try:
                        traci.vehicletype.copy(base_type, ev_type)
                        traci.vehicletype.setColor(ev_type, (255, 0, 0, 255))  # red in GUI
                    except Exception:
                        ev_type = base_type  # safe fallback

                # add EV
                traci.vehicle.add(vehID=EV_ID, routeID="", typeID=ev_type, depart=str(sim_time))
                traci.vehicle.setRoute(EV_ID, route_edges)

                ev_departed = True
                ev_depart_time = sim_time

            # EV arrived?
            if ev_departed and (EV_ID in traci.simulation.getArrivedIDList()):
                ev_arrival_time = sim_time
                break

            # No vehicles left but we haven't reached our keep-alive window yet? keep stepping.
            if traci.simulation.getMinExpectedNumber() == 0 and sim_time >= must_run_until:
                break

            if sim_time >= MAX_SIM_TIME:
                break

    finally:
        traci.close(False)

    # write CSV
    with open(OUTPUT_CSV, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ev_id", "depart_time_s", "arrival_time_s", "travel_time_s", "src_edge", "dst_edge"])
        tt = (ev_arrival_time - ev_depart_time) if (ev_depart_time is not None and ev_arrival_time is not None) else None
        w.writerow([EV_ID, ev_depart_time, ev_arrival_time, tt, src_edge_id, dst_edge_id])

    print(f"[Baseline] Wrote EV travel time to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
