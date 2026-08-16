import ezdxf
import math
from collections import defaultdict

# =========================
# CONFIG
# =========================
INPUT_FILE = "./output/points/demo.dxf"
OUTPUT_FILE = "output_with_diagonals.dxf"
TOLERANCE = 0.01  # adjust based on your DXF scale (mm usually)

# =========================
# UTILITIES
# =========================

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])

def snap_point(p, tol=TOLERANCE):
    # quantize for stable hashing
    return (round(p[0] / tol) * tol, round(p[1] / tol) * tol)

def midpoint(a, b):
    return ((a[0]+b[0])/2, (a[1]+b[1])/2)

# =========================
# LOAD DXF
# =========================

doc = ezdxf.readfile(INPUT_FILE)
msp = doc.modelspace()

raw_edges = []
points = set()

for e in msp.query("LINE"):
    a = snap_point((e.dxf.start.x, e.dxf.start.y))
    b = snap_point((e.dxf.end.x, e.dxf.end.y))
    raw_edges.append((a, b))
    points.add(a)
    points.add(b)

# =========================
# BUILD GRAPH
# =========================

graph = defaultdict(set)

for a, b in raw_edges:
    graph[a].add(b)
    graph[b].add(a)

# =========================
# FIND ALL CYCLES OF LENGTH 4
# =========================

def canonical_cycle(cycle):
    # normalize rotation direction & starting point
    min_idx = min(range(len(cycle)), key=lambda i: cycle[i])
    rotated = cycle[min_idx:] + cycle[:min_idx]
    return tuple(rotated)

def find_4_cycles():
    cycles = set()

    nodes = list(graph.keys())

    for a in nodes:
        for b in graph[a]:
            if b == a:
                continue
            for c in graph[b]:
                if c in (a, b):
                    continue
                for d in graph[c]:
                    if d in (a, b, c):
                        continue
                    if a in graph[d]:
                        cycle = canonical_cycle([a, b, c, d])
                        cycles.add(cycle)

    return list(cycles)

cycles = find_4_cycles()

# =========================
# FILTER VALID RECTANGLES
# =========================

def is_valid_quad(c):
    # ensure edges exist and geometry isn't degenerate
    for i in range(4):
        if c[(i+1) % 4] not in graph[c[i]]:
            return False

    # avoid weird bow-tie shapes: area check via shoelace
    area = 0
    for i in range(4):
        x1, y1 = c[i]
        x2, y2 = c[(i+1) % 4]
        area += x1 * y2 - x2 * y1

    return abs(area) > 1e-6

rectangles = [c for c in cycles if is_valid_quad(c)]

# =========================
# ADD DIAGONALS
# =========================

def add_line(p1, p2):
    msp.add_line(p1, p2)

for rect in rectangles:
    a, b, c, d = rect

    # diagonals
    add_line(a, c)
    add_line(b, d)

# =========================
# SAVE
# =========================

doc.saveas(OUTPUT_FILE)

print(f"Done. Rectangles found: {len(rectangles)}")