from flask import render_template, g
import sqlite3
import json

from agc_pins import app

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(app.config['delphi'])
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.route('/')
def index():
    return '<html><head><title>Apollo Replica Guidance Hardware</title></head><body><h1>Apollo Replica Guidance Hardware</h1><a href="/pins">AGC Backplane Viewer</a></body></html>'

@app.route('/pins')
def pin_inspector():
    return render_template('pin_inspector.html')

@app.route('/pins/pin/<conn>/<int:pin>')
def get_pin_info(conn, pin):
    c = get_db().cursor()
    res = c.execute('SELECT IOTYPE, NET FROM PINS WHERE CONNECTOR=? AND PIN=?', (conn, pin))
    try:
        iotype, net = res.fetchone()
    except:
        return '???'

    pin_data = {}
    pin_data['net'] = {}
    pin_data['net']['name'] = net
    pin_data['iotype'] = iotype
    pin_data['connections'] = []

    if net is not None and iotype not in ["SPARE", "NC", "UNK"]:
        for net_conn, net_pin in c.execute('SELECT CONNECTOR, PIN FROM PINS WHERE NET=? AND NOT ((IOTYPE="NC") OR (CONNECTOR=? AND PIN=?))', (net, conn, pin)):
            pin_data['connections'].append({'connector': net_conn, 'pin': net_pin})
        res = c.execute('SELECT DESCRIPTION FROM NETS WHERE NET=?', (net,))
        pin_data['net']['description'] = res.fetchone()[0]

    return json.dumps(pin_data)

@app.route('/pins/pin_classes/<tray>')
def get_pin_classes(tray):
    c = get_db().cursor()

    pin_classes = {}
    pin_classes['pin_classes'] = []
    for conn, pin, net, iotype, notes in c.execute('SELECT CONNECTOR, PIN, NET, IOTYPE, NOTES FROM PINS WHERE CONNECTOR LIKE ?', (tray+'%',)):
        if iotype == 'UNK' or (notes is not None and "@GUESS" in notes):
            pin_class = "UNK"
        elif iotype in ['NC', 'SPARE', 'BP']:
            pin_class = iotype
        elif net in ['+4VDC', '+4SW', 'BPLUS', 'BPLSSW', 'FAP']:
            pin_class = net
        elif net.startswith('CG'+tray) or net in ['0VDCA', '0VDC']:
            pin_class = '0VDC'
        else:
            pin_class = 'DATA'

        pin_classes['pin_classes'].append({'connector': conn, 'pin': pin, 'pin_class': pin_class})

    return json.dumps(pin_classes)

@app.route('/pins/net/<path:net>')
def get_net_pins(net):
    c = get_db().cursor()

    net_data = {
        'description': '',
        'connections': [],
    }

    res = c.execute('SELECT DESCRIPTION FROM NETS WHERE NET=?', (net,)).fetchone()
    if res is not None:
        net_data['description'] = res[0]
        net_data['connections'] = []

        for net_conn, net_pin in c.execute('SELECT CONNECTOR, PIN FROM PINS WHERE NET=? AND NOT IOTYPE="SPARE"', (net,)):
            net_data['connections'].append({'connector': net_conn, 'pin': net_pin})

    return json.dumps(net_data)

