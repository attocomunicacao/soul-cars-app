# O Windows bloqueou o Soul Cars (Smart App Control)

Se o Launcher mostrar **"O Windows bloqueou o Soul Cars (Smart App Control)"**, o app foi
instalado corretamente, mas o Windows não deixou ele abrir.

## Por que acontece

O **Smart App Control** é uma proteção do Windows 11, ligada de fábrica em instalações novas.
Ele só deixa rodar programas que:

- têm **assinatura digital** de um fornecedor identificado, **ou**
- já são **conhecidos pela Microsoft** (reputação na nuvem).

O Soul Cars ainda **não tem assinatura digital**. Por isso, dependendo da reputação que o
Windows atribui ao arquivo naquele momento, ele pode ser bloqueado. O bloqueio pode aparecer
num dia e não no outro, e é diferente do aviso azul "O Windows protegeu o seu PC" (SmartScreen),
que tem o botão **Executar assim mesmo**: o Smart App Control **não tem** essa opção.

## O que o Launcher faz sozinho

Cada versão nova é um arquivo que a Microsoft ainda não conhece, então costuma ser bloqueada
nas primeiras horas e liberada depois. Por isso o Launcher:

1. **Guarda a última versão que abriu** e nunca a apaga ao atualizar.
2. **Abre essa versão anterior** quando o Windows bloqueia a nova, e mostra o aviso
   *"O Windows ainda está verificando a versão X… Abrimos a versão Y"*.
3. Na próxima vez que você clicar em **Abrir**, tenta de novo a versão nova; quando o Windows
   liberar, ela passa a abrir normalmente.

Nada é desativado no Windows: a versão anterior simplesmente já é aceita por ele. A mensagem
de bloqueio só aparece quando **nenhuma** versão instalada pode abrir (por exemplo, logo na
primeira instalação). Aí, espere algumas horas e tente de novo, ou veja as opções abaixo.

## Como conferir se o Smart App Control está ligado

**Configurações › Privacidade e segurança › Segurança do Windows › Controle de aplicativos e
navegador › Configurações do Smart App Control**. O estado aparece como *Ativado*,
*Avaliação* ou *Desativado*.

## O que fazer

| Opção | Resultado | Atenção |
|---|---|---|
| **Tentar abrir de novo mais tarde** | Às vezes o Windows passa a reconhecer o arquivo e libera | Não há garantia |
| **Desligar o Smart App Control** neste computador | O Soul Cars abre normalmente | **Depois de desligado, o Windows não deixa ligar de novo** sem reinstalar o sistema. Os demais recursos de segurança (Microsoft Defender, SmartScreen) continuam ativos. Decida com quem cuida dos computadores da loja. |
| **Esperar a versão assinada** | Abre em qualquer Windows, sem avisos | Depende de a loja contratar um certificado de assinatura de código |

## Para quem cuida dos computadores

O Launcher registra cada tentativa em `%LOCALAPPDATA%\SoulCars\logs\launcher.log`. Os bloqueios
também aparecem no **Visualizador de Eventos › Logs de Aplicativos e Serviços › Microsoft ›
Windows › CodeIntegrity › Operacional** (eventos 3033 e 3077, citando `SoulCars.exe`).
