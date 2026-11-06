"""Assinatura final: aproximação centralizada, entrada e saída suaves."""


def suave(p: str) -> str:
    return f"(({p})*({p})*(3-2*({p})))"


def filtros(indice: int, duracao: float, largura: int, altura: int, fps: str) -> list[str]:
    if duracao <= 0:
        raise ValueError("A duração do encerramento deve ser positiva.")
    entrada = min(0.95, duracao * 0.25)
    saida = min(0.45, duracao * 0.15)
    t = f"((on-1)/({fps}))"
    p = f"max(0,min(1,{t}/{entrada}))"
    q = f"max(0,min(1,({t}-{entrada})/{duracao-entrada-saida}))"
    escala = f"(0.94+0.06*{suave(p)}+0.03*{suave(q)})"
    x0, x1 = f"W/2-W/2*{escala}", f"W/2+W/2*{escala}"
    y0, y1 = f"H/2-H/2*{escala}", f"H/2+H/2*{escala}"
    return [
        f"color=c=0x191919:s={largura}x{altura}:r={fps}:d={duracao}[bg]",
        f"[{indice}:v]scale={largura}:-1,setsar=1,format=gbrap,"
        f"perspective=x0='{x0}':y0='{y0}':x1='{x1}':y1='{y0}':"
        f"x2='{x0}':y2='{y1}':x3='{x1}':y3='{y1}':"
        "sense=destination:eval=frame:interpolation=cubic,format=rgba,"
        f"fade=t=in:st=0:d={min(0.6, entrada)}:color=0x191919,"
        f"fade=t=out:st={duracao-saida}:d={saida}:color=0x191919[lg]",
        f"[bg][lg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p,"
        f"setsar=1,trim=duration={duracao},setpts=PTS-STARTPTS[card]",
    ]
