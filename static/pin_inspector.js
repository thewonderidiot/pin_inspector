function PinInspector(tray) {
    var mouse_down_evt = null;
    var selected_pin = null;
    var connected_pins = new Set();
    var lines = new Set();
    var tray_letter = tray.id.slice(-1).toUpperCase();

    var pin_class_colors = {
        "0VDC": "#444444",
        "NC": "#E8E8E8",
        "SPARE": "#FFFFFF",
        "+4SW": "red",
        "+4VDC": "#C00000",
        "BPLUS": "orange",
        "BPLSSW": "#8B4000",
        "FAP": "yellow",
        "DATA": "#8090FF",
        "UNK": "#FF80D0",
    }

    var io_types = {
        "NC": "N/C",
        "SPARE": "Spare",
        "IN": "Input",
        "OUT": "Output",
        "INOUT": "Input/output",
        "FIX": "Fan-in",
        "FOX": "Fan-out",
        "UNK": "Unknown",
    }

    var svg = null;
    try {
        svg = tray.contentDocument;
    } catch (e) {
        svg = tray.getSVGDocument();
    }

    svg.documentElement.addEventListener("mousedown", tray_mouse_down, false);
    svg.documentElement.addEventListener("mouseup", tray_mouse_up, false);


    fetch('/pins/pin_classes/'+tray_letter)
        .then(function(response) {
            return response.json();
        })
        .then(function(result) {
            for (var i = 0; i < result.pin_classes.length; i++)
            {
                try {
                    var pin_id = result.pin_classes[i].connector + "_" + result.pin_classes[i].pin;
                    var pin = svg.getElementById(pin_id);
                    pin.style["fill"] = pin_class_colors[result.pin_classes[i].pin_class];
                } catch (e) {
                    alert("Pin id: " + result.pin_classes[i].connector + "_" + result.pin_classes[i].pin);
                }
            }
        });


    function tray_mouse_down(evt) {
        mouse_down_evt = evt;
    }

    function unselect_pin(pin)
    {
        var radius = pin.getAttribute("r");
        pin.setAttribute("r", radius/1.2);

        var stroke_width = parseFloat(pin.getAttribute("stroke-width"));
        pin.setAttribute("stroke-width", (stroke_width / 3).toString());
        pin.setAttribute("stroke", "#000000");

        selected_pin = null;
    }

    function select_pin(pin)
    {
        if (selected_pin != null)
        {
            unselect_pin(selected_pin);
        }

        var radius = pin.getAttribute("r");
        pin.setAttribute("r", radius*1.2);

        var stroke_width = parseFloat(pin.getAttribute("stroke-width"));
        pin.setAttribute("stroke-width", (stroke_width * 3).toString());
        pin.setAttribute("stroke", "#3282A7");

        selected_pin = pin;
    }

    function disconnect_pins() {
        var pin_layer = svg.getElementById("pins");
        for (let l of lines) {
            pin_layer.removeChild(l);
        }
        for (let c of connected_pins) {
            var radius = c.getAttribute("r");
            c.setAttribute("r", radius/1.2);
        }
        connected_pins.clear();
        lines.clear();
    }

    function connect_pins(pin, connections) {
        connected_pins.add(pin);
        var disconnected_pins = new Set();

        for (var i = 0; i < connections.length; i++) {
            var target_info = connections[i];
            var target_id = target_info["connector"] + "_" + target_info["pin"];
            if (target_id[0] == tray_letter) {
                disconnected_pins.add(svg.getElementById(target_id));
            }
        }

        var pin_layer = svg.getElementById("pins");
        var total_wires = disconnected_pins.size;

        var stroke_width = (parseFloat(pin.getAttribute("stroke-width")) / 2).toString();

        for (k = 0; k < total_wires; k++)
        {
            var min_dist = 99999;
            var closest_connected = null;
            var closest_disconnected = null;
            connected_loop:
            for (let c of connected_pins) {
                for (let u of disconnected_pins) {
                    var dx = c.getAttribute("cx") - u.getAttribute("cx");
                    var dy = c.getAttribute("cy") - u.getAttribute("cy");
                    var dist = Math.sqrt(dx*dx+dy*dy);
                    if (dist < min_dist) {
                        min_dist = dist;
                        closest_connected = c;
                        closest_disconnected = u;

                        if (dist < 12) {
                            break connected_loop;
                        }
                    }
                }
            }

            var conn_line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            conn_line.setAttribute("id", "line"+k);
            conn_line.setAttribute("x1", closest_connected.getAttribute("cx"));
            conn_line.setAttribute("y1", closest_connected.getAttribute("cy"));
            conn_line.setAttribute("x2", closest_disconnected.getAttribute("cx"));
            conn_line.setAttribute("y2", closest_disconnected.getAttribute("cy"));
            conn_line.setAttribute("stroke", "#000000");
            conn_line.setAttribute("stroke-width", stroke_width);
            pin_layer.append(conn_line);
            lines.add(conn_line);
            connected_pins.add(closest_disconnected);
            disconnected_pins.delete(closest_disconnected);
        }

        for (let c of connected_pins)
        {
            pin_layer.removeChild(c);
            pin_layer.append(c);

            var radius = c.getAttribute("r");
            c.setAttribute("r", radius*1.2);
        }
    }

    function tray_mouse_up(evt) {
        var dx = Math.abs(mouse_down_evt.clientX  - evt.clientX);
        var dy = Math.abs(mouse_down_evt.clientY  - evt.clientY);

        if ((dx > 1) || (dy > 1)) {
            return;
        }

        pin = evt.target;
        if (pin.id.match(/[AB]\d\d?_\d\d\d/)) {
            select_pin(pin);

            var pin_num = pin.id.split("_");
            document.getElementById("conn_text").innerHTML = pin_num[0];
            document.getElementById("pin_text").innerHTML = pin_num[1];

            fetch('/pins/pin/'+pin_num[0]+'/'+pin_num[1])
                .then(function(response) {
                    return response.json();
                })
                .then(function(result) {
                    var net = result["net"]["name"];
                    var description = "";
                    if (net == null) {
                        net = "-";
                    } else {
                        description = result["net"]["description"];
                    }
                    document.getElementById("io_text").innerHTML = io_types[result["iotype"]];
                    document.getElementById("net_text").innerHTML = net;
                    document.getElementById("desc_text").innerHTML = description;

                    disconnect_pins();
                    connect_pins(pin, result["connections"]);
                });
        }
    }
}
