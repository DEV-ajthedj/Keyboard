import pcbnew

board = pcbnew.GetBoard()


# Generate the same capacitor list used for the NeoPixels
def get_cap_number(index):
    group = index // 8
    position = index % 8

    if position == 0:
        return 18 + group
    else:
        return 39 + (group * 7) + (position - 1)


for i in range(88):

    cap_ref = f"C{get_cap_number(i)}"

    cap = board.FindFootprintByReference(cap_ref)

    if cap is None:
        print("Missing capacitor:", cap_ref)
        continue


    # Get current rotation
    current_angle = cap.GetOrientation().AsDegrees()

    # Rotate 180 degrees
    new_angle = current_angle + 180

    cap.SetOrientationDegrees(new_angle)

    print(
        f"{cap_ref}: {current_angle} -> {new_angle}"
    )


board.Save("keyboard.kicad_pcb")

print("Finished flipping NeoPixel decoupling capacitors")