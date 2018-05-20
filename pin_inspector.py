from flask import Flask, render_template
import sqlite3
import json
app = Flask(__name__)

@app.route('/')
def index():
    return 'Hello world'

@app.route('/pins')
def pin_inspector():
    return render_template('pin_inspector.html')

@app.route('/pins/pin/<conn>/<int:pin>')
def get_pin_info(conn, pin):
    delphi = sqlite3.connect('delphi.db')
    c = delphi.cursor()
    res = c.execute('SELECT IOTYPE, NET FROM PINS WHERE CONNECTOR="%s" AND PIN=%u' % (conn, pin))
    try:
        iotype, net = res.fetchone()
    except:
        return '???'

    pin_data = {}
    pin_data['net'] = {}
    pin_data['net']['name'] = net
    pin_data['iotype'] = iotype
    pin_data['connections'] = []

    if net is not None and iotype not in ["SPARE", "NC"]:
        for net_conn, net_pin in c.execute('SELECT CONNECTOR, PIN FROM PINS WHERE NET="%s" AND NOT ((IOTYPE="NC") OR (CONNECTOR="%s" AND PIN=%u))' % (net, conn, pin)):
            pin_data['connections'].append({'connector': net_conn, 'pin': net_pin})
        res = c.execute('SELECT DESCRIPTION FROM NETS WHERE NET="%s"' % net)
        pin_data['net']['description'] = res.fetchone()[0]

    return json.dumps(pin_data)

@app.route('/pins/pin_classes/<tray>')
def get_pin_classes(tray):
    delphi = sqlite3.connect('delphi.db')
    c = delphi.cursor()

    pin_classes = {}
    pin_classes['pin_classes'] = []
    for conn, pin, net, iotype in c.execute('SELECT CONNECTOR, PIN, NET, IOTYPE FROM PINS WHERE CONNECTOR LIKE "%s%%"' % tray):
        if iotype in ['NC', 'SPARE']:
            pin_class = iotype
        elif net in ['+4VDC', '+4SW', 'BPLUS', 'BPLSSW', 'FAP']:
            pin_class = net
        elif net.startswith('CG'+tray) or net in ['0VDCA', '0VDC']:
            pin_class = '0VDCA'
        else:
            pin_class = 'DATA'

        pin_classes['pin_classes'].append({'connector': conn, 'pin': pin, 'pin_class': pin_class})

    return json.dumps(pin_classes)

