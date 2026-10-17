"""Build the offshore warning-range map overlay."""
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import splprep, splev
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUTLINE_PX = [
    (354, 17), (350, 28), (341, 48), (327, 75), (310, 103),
    (287, 131), (263, 154), (229, 176), (250, 192), (272, 212),
    (293, 235), (319, 264), (344, 286), (370, 304), (381, 307),
    (393, 299), (406, 282), (419, 258), (430, 231), (440, 202),
    (447, 169), (454, 139), (455, 110), (450, 88), (435, 73),
    (415, 59), (393, 44), (372, 28),
]

# Coordinate control points for the offshore outline.
px = np.array(OUTLINE_PX, dtype=float)
curve, _ = splprep([px[:, 0], px[:, 1]], s=0, per=True, k=3)
xs, ys = splev(np.linspace(0, 1, 192, endpoint=False), curve)
coordinates = [[round(121.6 + (x - 399) / 44, 5), round(25.3 - (y - 112) / 45, 5)] for x, y in zip(xs, ys)]
coordinates.append(coordinates[0])
outer = Polygon(coordinates)
assert outer.is_valid
counties = json.loads((ROOT / 'public/data/taiwan-counties.json').read_text())
world_land = json.loads((ROOT / 'public/data/land.json').read_text())
land_shapes = [shape(feature['geometry']) for feature in world_land['features']]
land_shapes = [geometry.intersection(outer) for geometry in land_shapes if geometry.intersects(outer)]
land = unary_union(land_shapes + [shape(feature['geometry']) for feature in counties['features']])
sea = outer.difference(land)
assert sea.is_valid and not sea.is_empty
metadata = {'name': '海上警戒範圍'}
line = {'type': 'FeatureCollection', 'features': [{'type': 'Feature',
        'properties': metadata, 'geometry': {'type': 'LineString', 'coordinates': coordinates}}]}
zone = {'type': 'FeatureCollection', 'features': [{'type': 'Feature',
        'properties': {'name': '海上警戒範圍'},
        'geometry': mapping(sea)}]}
for name, value in [('taiwan-sea-line.json', line), ('taiwan-sea-zone.json', zone)]:
    (ROOT / 'public/data' / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
