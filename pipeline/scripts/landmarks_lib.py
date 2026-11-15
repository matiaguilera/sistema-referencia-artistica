"""
Medición de las referencias de proporción sobre el perfil medio de la piel.
Lo usan assemble.py y measure_landmarks.py. Coordenadas de Blender (Z arriba, cara hacia -Y).
"""
import numpy as np


def _band(pts, axis, lo, hi):
    return pts[(pts[:, axis] >= lo) & (pts[:, axis] <= hi)]


def front_profile(sv, E, step=0.001):
    """
    Silueta frontal de la línea media: para cada franja de 1 mm de altura, el punto más adelantado.
    (Así no interfieren la cavidad de la boca ni el interior de las fosas nasales.)
    Devuelve un arreglo (K×2) de [z, y] ordenado de arriba hacia abajo.
    """
    mid = sv[(np.abs(sv[:, 0]) < 0.004) & (sv[:, 1] < E[1] + 0.03)]
    bins = np.floor(mid[:, 2] / step).astype(int)
    out = {}
    for b, y in zip(bins, mid[:, 1]):
        if b not in out or y < out[b]:
            out[b] = y
    keys = sorted(out, reverse=True)
    prof = np.array([[(k + 0.5) * step, out[k]] for k in keys])
    # Franjas sin vértices de la superficie (solo puntos interiores) dan saltos: se descartan
    # las que se alejan más de 4 mm de la mediana de sus vecinas.
    ys = prof[:, 1]
    keep = np.ones(len(ys), dtype=bool)
    for i in range(len(ys)):
        lo, hi = max(0, i - 3), min(len(ys), i + 4)
        if abs(ys[i] - np.median(ys[lo:hi])) > 0.004:
            keep[i] = False
    return prof[keep]


def measure(sv, E):
    """
    sv: vértices de la piel (N×3). E: centro entre los ojos.
    Devuelve alturas absolutas (z): top, brow, nose_base, mouth, chin.
    """
    top = sv[np.abs(sv[:, 0]) < 0.03, 2].max()
    prof = front_profile(sv, E)
    z, y = prof[:, 0], prof[:, 1]

    def zone(lo, hi):
        m = (z >= lo) & (z <= hi)
        return z[m], y[m]

    # Mentón: punto más bajo del perfil por delante de los ojos, sin llegar al pecho.
    zc, yc = zone(E[2] - 0.17, E[2] - 0.05)
    chin = zc[yc < E[1] + 0.005].min()

    # Cejas: punto más adelantado de la frente baja (glabela).
    zg, yg = zone(E[2] + 0.005, E[2] + 0.03)
    brow = zg[yg.argmin()]

    # Base de la nariz (subnasal): bajando desde la punta, la silueta retrocede bajo la nariz
    # y vuelve a avanzar en el labio superior; el subnasal es el primer punto de retroceso máximo.
    zn, yn = zone(E[2] - 0.08, E[2] - 0.015)
    tip_z = zn[yn.argmin()]
    zb, yb = zone(tip_z - 0.03, tip_z)
    order = np.argsort(-zb)  # de arriba hacia abajo
    nose_base, best = tip_z, -np.inf
    for i in order:
        if yb[i] > best:
            best, nose_base = yb[i], zb[i]
        elif best - yb[i] > 0.0008:
            break

    # Boca (stomion): entre el labio superior y el inferior (los dos puntos más salientes
    # debajo de la nariz), el punto más hundido de la silueta.
    mouth = nose_base - 0.02
    zu, yu = zone(nose_base - 0.03, nose_base - 0.004)
    if len(zu):
        ul = zu[yu.argmin()]
        zl, yl = zone(ul - 0.03, ul - 0.006)
        if len(zl):
            ll = zl[yl.argmin()]
            zg2, yg2 = zone(ll, ul)
            if len(zg2):
                mouth = zg2[yg2.argmax()]
    return dict(top=float(top), brow=float(brow), nose_base=float(nose_base), mouth=float(mouth), chin=float(chin))
