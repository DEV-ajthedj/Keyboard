import pcbnew
import math

board = pcbnew.GetBoard()


# -----------------------------
# LED offset from switch center
# -----------------------------

OFFSET_X = 0.0
OFFSET_Y = 5.0


# -----------------------------
# Helpers
# -----------------------------

def rotate_vector(x, y, angle_deg):
    """
    Rotate the LED offset vector.
    Uses KiCad B.Cu coordinate convention.
    """

    angle = math.radians(-angle_deg)

    return (
        x * math.cos(angle) - y * math.sin(angle),
        x * math.sin(angle) + y * math.cos(angle)
    )


def ref_number(fp):
    nums = ''.join(
        c for c in fp.GetReference()
        if c.isdigit()
    )

    return int(nums) if nums else 0


# -----------------------------
# Find switches
# -----------------------------

switches = []

for fp in board.GetFootprints():

    if fp.GetFPID().GetLibItemName() == "Hotswap_MX":
        switches.append(fp)

switches.sort(key=ref_number)


# -----------------------------
# Find LEDs D90-D177
# -----------------------------

leds = []

for fp in board.GetFootprints():

    ref = fp.GetReference()

    if ref.startswith("D"):

        nums = ''.join(
            c for c in ref
            if c.isdigit()
        )

        if nums:

            n = int(nums)

            if 90 <= n <= 177:
                leds.append(fp)

leds.sort(key=ref_number)


print("Switches found:", len(switches))
print("LEDs found:", len(leds))


if len(switches) != len(leds):
    print("ERROR: switch and LED count mismatch")
    raise SystemExit


# -----------------------------
# Apply placement
# -----------------------------

for sw, led in zip(switches, leds):

    sw_pos = sw.GetPosition()
    sw_rot = sw.GetOrientationDegrees()


    # Rotate offset first
    ox, oy = rotate_vector(
        OFFSET_X,
        OFFSET_Y,
        sw_rot
    )


    # Translate second
    new_x = sw_pos.x + pcbnew.FromMM(ox)
    new_y = sw_pos.y + pcbnew.FromMM(oy)


    led.SetPosition(
        pcbnew.VECTOR2I(
            int(new_x),
            int(new_y)
        )
    )


    # Reverse mount LED
    led.SetLayer(pcbnew.B_Cu)


    # Match switch visual direction
    led.SetOrientationDegrees(
        sw_rot
    )


    print(
        f"{led.GetReference()} <- {sw.GetReference()} "
        f"pos=({pcbnew.ToMM(new_x):.3f}, "
        f"{pcbnew.ToMM(new_y):.3f}) "
        f"rot={sw_rot}"
    )


print("Finished placing LEDs!")