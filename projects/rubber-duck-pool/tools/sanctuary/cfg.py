"""
Master Configuration Block — Botanical Onsen Hydro-Sanctuary v4 (1.5x Grand Expansion).
Addresses ALL 5 user upgrade directives:
1. Open tiled Water Intake Channel from Lower Whirlpool Grotto directly under suspended flared Siphon Lift Bell -> Glass Return Tube
2. 1.5x Map & Pool expansion (36.0m x 32.5m estate, 16.5m x 10.2m Upper Pool w/ Roman steps alcove, Ø 8.0m Lower Grotto) anchored to exact 0.38m official ducks
3. Rich playful pool toys & inflatables (Flamingo float, Palm Island float, 3 swim rings, beach balls, noodles, floating Yuzu tray, Toro Nagashi lanterns, 30 official ducks!)
4. Full Walk-In Onsen Bathhouse Interior (3.4m wide open doorway -> tatami room w/ diegetic Brightness Dimmer, Max Duck Slider Board, Radio Console)
5. Veranda Tea Desk (Chabudai) w/ clickable Gold-Embossed Emerald Collection Compendium Book + fountain pen
"""

import os

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(TOOLS_DIR))
BASE_DIR = os.path.join(PROJECT_ROOT, "models", "sanctuary")
V3_TEX_DIR = os.path.join(BASE_DIR, "v3_textures")
TEX_DIR = os.path.join(BASE_DIR, "textures")
RENDERS_DIR = os.path.join(BASE_DIR, "renders")
BLEND_PATH = os.path.join(BASE_DIR, "hydro_sanctuary_v4.blend")
GLB_PATH = os.path.join(PROJECT_ROOT, "public", "sanctuary", "hydro_sanctuary_v4.glb")
DUCK_MODELS_DIR = os.path.join(PROJECT_ROOT, "models")

CFG = {
    "duck_scale": 0.38,  # Exact official game scale -> 16.5m pool is ~43 ducks wide x 26 ducks deep!
    # Upper Sanctuary Terrace (Z = 0.00 m, 36.0m wide x 20.4m deep!)
    "up_x0": -18.5, "up_x1": 17.5,
    "up_y0": -7.4,  "up_y1": 13.0,
    "up_z": 0.0,
    # Lower Grotto Garden Terrace (Z = -2.10 m, 29.6m wide x 12.1m deep!)
    "lo_x0": -14.8, "lo_x1": 14.8,
    "lo_y0": -19.5, "lo_y1": -7.4,
    "lo_z": -2.10,
    # Grand Upper Emerald Reflection Pool (1.5x v3 -> 16.5m x 10.2m + West Semi-Circular Roman Steps Bay!)
    "pool_x0": -3.55, "pool_x1": 12.95, # 16.5 m wide (~43 ducks!)
    "pool_y0": -3.6, "pool_y1": 6.6,    # 10.2 m deep (~26 ducks!)
    "pool_r": 1.35,
    "pool_coping_w": 0.50,
    "pool_coping_h": 0.12,
    "pool_water_z": -0.10,
    "pool_floor_z": -1.10,
    # West Roman Semi-Circular Steps Alcove projecting from West Pool Edge toward Onsen Engawa!
    "roman_cy": 1.50,
    "roman_r": 2.65,
    # West Wing — Full-Scale Walk-In Hinoki Onsen Bathhouse & Engawa Veranda (ZERO roof overlap!)
    "onsen_x0": -17.4, "onsen_x1": -11.2,  # 6.2 m deep walkable interior!
    "onsen_y0": -2.6,  "onsen_y1": 9.0,    # 11.6 m wide (5 generous shoji bays!)
    "onsen_plinth_h": 0.44,
    "onsen_engawa_x1": -9.05,              # 2.15 m deep wooden veranda (fits Chabudai tea desk + book!)
    "onsen_wall_h": 3.55,                  # Eaves at Z = 3.99 m
    "onsen_roof_rise": 2.25,               # Ridge at Z = 6.24 m
    "onsen_eave_ov": 0.72,                 # Front eave stops at X = -8.75 (1.60 m clear of Conservatory X = -7.15!)
    # Center & East Wing — Soaring Victorian Verdigris Glasshouse Conservatory (24.15m x 19.4m, Vault Z = 12.15m!)
    "cons_x0": -7.15, "cons_x1": 17.0,
    "cons_y0": -6.8, "cons_y1": 12.6,
    "cons_eave_z": 6.10,
    "cons_vault_z": 12.15,
    # Lower Circular Fern Whirlpool Grotto (1.5x -> Ø 8.0m inner, ~21 ducks across!)
    "grotto_xy": (0.20, -13.20),
    "grotto_r_in": 4.00,
    "grotto_r_out": 5.30,
    "grotto_rim_z": -1.68,
    "grotto_water_z": -2.18,
    "grotto_floor_z": -3.10,
    # Open Tiled Intake Water Channel connecting Lower Whirlpool Grotto directly under Siphon Lift Bell!
    "intake_w": 1.80,
    "intake_x_end": 8.65,
    # Suspended Flared Glass & Brass Siphon Lift Tower (straddling Intake Water Basin at X = 7.75, Y = -13.20!)
    "siphon_xy": (7.75, -13.20),
    "siphon_r": 0.68,
    "siphon_bell_z0": -1.85,  # Open flared suction mouth hovering cleanly 0.33m over intake water!
    "siphon_glass_z0": -0.95,
    "siphon_glass_z1": 4.45,
    "siphon_cap_z": 4.80,
    "siphon_tube_r": 0.35,    # 0.70 m inner bore -> official 0.38m ducks ride visibly!
    # Master Widescreen Display Camera
    "cam_hero_pos": (-0.6, -29.8, 13.8),
    "cam_hero_target": (-0.2, -2.0, 1.45),
    "cam_hero_lens": 25.5,
}
