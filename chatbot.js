const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');

const client = new Client();
const delay = ms => new Promise(res => setTimeout(res, ms));

const userActivity = new Map();
const userState = new Map();

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
    setInterval(verificarInatividade, 60000);
});

client.initialize();

function registrarAtividade(user) {
    userActivity.set(user, Date.now());
}

async function verificarInatividade() {
    const agora = Date.now();
    for (const [user, timestamp] of userActivity.entries()) {
        const tempoInativo = agora - timestamp;

        if (tempoInativo >= 10 * 60000) {
            await client.sendMessage(user, 'Encerramos seu atendimento devido à inatividade. Caso precise de algo, digite "menu" para reiniciar.');
            await delay(2000);
            await client.sendMessage(user, 'Antes de encerrar completamente, por favor, avalie o quanto o atendimento foi útil para você (responda com um número):\n\n1 - Muito útil\n2 - Útil\n3 - Pouco útil\n4 - Nada útil');
            userActivity.delete(user);
            userState.set(user, 'avaliacao');
        } else if (tempoInativo >= 1.5 * 60000 && tempoInativo < 2.5 * 60000) {
            await client.sendMessage(user, 'Ainda está por aqui? Se precisar de ajuda, estou à disposição.');
        }
    }
}

async function mostrarMenu(user) {
    const contact = await client.getContactById(user);
    const name = contact.pushname || 'Aluno(a)';
    const primeiroNome = name.split(" ")[0];

    await delay(2000);
    await client.sendMessage(user,
`Olá, ${primeiroNome}! 👋 Seja bem-vindo(a) ao atendimento virtual da Secretaria da Estácio Campus Barra Tom Jobim.

Nosso atendimento com os focais dos processos funciona de segunda à sexta, das 10h às 20h.

Selecione uma das opções abaixo para que possamos te auxiliar:

1 - Estágio
2 - ProUni / FIES
3 - Colação de Grau / Diplomas
4 - Declarações / Documentos
5 - Renovação de Matrícula
6 - Dúvidas Financeiras
7 - Dúvidas Acadêmicas
8 - Dúvidas sobre SIA / SAVA
9 - Outros`
    );
    userState.set(user, 'menu');
}

client.on('message', async msg => {
    const texto = msg.body.trim();
    const chat = await msg.getChat();
    const user = msg.from;

    registrarAtividade(user);
    const estado = userState.get(user) || 'menu';

    // === ETAPA: AVALIAÇÃO ===
    if (estado === 'avaliacao') {
        if (["1", "2", "3", "4"].includes(texto)) {
            await client.sendMessage(user, 'Agradecemos seu feedback! Atendimento encerrado. Quando precisar, só entrar em contato.');
            userState.delete(user);
        } else {
            await client.sendMessage(user, 'Por favor, responda com um número de 1 a 4 para avaliar o atendimento.');
        }
        return;
    }

    // === ETAPA: PÓS-ATENDIMENTO ===
    if (estado === 'pos-atendimento') {
        if (texto.toLowerCase() === 'sim') {
            await client.sendMessage(user, 'Perfeito! Retornando ao menu principal...');
            await delay(1500);
            await mostrarMenu(user);
        } else if (["não", "nao"].includes(texto.toLowerCase())) {
            userState.set(user, 'avaliacao');
            await client.sendMessage(user,
                'Antes de encerrarmos, por favor, avalie o quanto o atendimento foi útil para você (responda com um número):\n\n1 - Muito útil\n2 - Útil\n3 - Pouco útil\n4 - Nada útil'
            );
        } else {
            await client.sendMessage(user, 'Por favor, responda com "Sim" ou "Não". Você precisa de mais alguma coisa?');
        }
        return;
    }

    // === Somente entra no menu se estiver no estado 'menu' e enviar uma saudação ===
    if (estado === 'menu' && texto.match(/^(menu|oi|olá|ola|bom dia|boa tarde|boa noite)$/i)) {
        await mostrarMenu(user);
        return;
    }

    // === Se usuário tenta escolher opção do menu fora do estado correto ===
    if (!['menu'].includes(estado) && /^[1-9]$/.test(texto)) {
        await client.sendMessage(user, 'Você ainda não pode escolher uma opção do menu. Por favor, conclua a etapa anterior.');
        return;
    }

    // === OPÇÕES DO MENU ===
    if (estado === 'menu') {
        switch (texto) {
            case '1':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📘 Estágio - Instruções iniciais: \n1. Estágio Obrigatório: Se você está matriculado na disciplina de Estágio, compareça à Secretaria para iniciar o processo.\n2. Estágio Não Obrigatório: Para estagiar, é necessário estar com a matrícula ativa. Compareça à Secretaria com o Termo de Compromisso (TCE).📌 Em ambos os casos, leve o TCE assinado para agilizarmos o atendimento.)E assinado. ');
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, 'Ainda esta com dúvidas?📲 Fale com o Focal: https://wa.me/5521979190767');
                break;

            case '2':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📚 PROUNI/FIES: fale com o focal da unidade:\nhttps://wa.me/5521983789869');
                break;

            case '3':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '🎓 Informações no portal do aluno. Dúvidas? Fale com a Secretaria.');
                break;

            case '4':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📄 Documentos devem ser solicitados no portal. Dificuldades? Fale com a Secretaria.');
                break;

            case '5':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '📆 A renovação de matrícula está disponível no portal. Problemas? Fale com a Secretaria.');
                break;

            case '6':
                await client.sendMessage(user, '💰 Dúvidas financeiras? Fale com o setor responsável: https://wa.me/8008806772');
                break;

            case '7':
                await client.sendMessage(user, '📘 Questões acadêmicas? Fale com o coordenador ou a Secretaria.');
                break;

            case '8':
                await chat.sendStateTyping(); await delay(2000);
                await client.sendMessage(user, '💡Como acessar o SIA? Com o número de matrícula \n1. Acesse o endereço https://sia.estacio.br/sianet/logon.  \n2. Informe seu número de matrícula. Se você não souber ou tiver esquecido, clique na opção “Não sei ou esqueci minha Matrícula". \n3. Clique em "Esqueci minha senha/Cadastrar minha primeira senha";\n4. Siga as instruções que chegarão por e-mail.');
                await chat.sendStateTyping(); await delay(8000);
                await delay(8000);
                await client.sendMessage(user, 'Veja como acessar o SIA apenas com seu e-mail de estudante:');
                await chat.sendStateTyping(); await delay(3000);
                await delay(4000);
                await client.sendMessage(user, '1. Clique na opção “Entrar com o e-mail de estudante”.\n2. Informe o seu e-mail do estudante. Na Estácio, o e-mail do estudante tem o seguinte formato: número da matrícula + @alunos.estacio.br.\n3. Insira a sua senha padrão, que é composta pelos seis primeiros dígitos do seu CPF + @ + as duas primeiras letras do seu nome, sendo a primeira maiúscula e a segunda minúscula.');
                await chat.sendStateTyping(); await delay(2000);
                await delay(20000);
                await client.sendMessage(user, 'Como acessar a SAVA Estácio ?\nVocê consegue acessar a Sala de Aula Virtual por diferentes caminhos: Link direto e pelo App Minha Estácio.\n1. App Minha Estácio: pelo aplicativo, você consegue acessar diretamente suas disciplinas matriculadas.\n2. Link Direto: basta acessar o link estudante.estacio.br/login e entrar na sua conta usando seu E-mail de Estudante e senha padrão.Em todos os caminhos você deve utilizar seu E-mail Estudante e a senha padrão para acessar a Sala de Aula Virtual.');
                await chat.sendStateTyping(); await delay(8000);
                await delay(10000);
                await client.sendMessage(user, 'Lembrando que:\n\n> o e-mail de Estudante é formado pela #sua matricula# + @ + alunos.estacio.br \n> a senha padrão é composta pelos seis primeiros dígitos do seu CPF + @ + as duas primeiras letras do seu nome, sendo a primeira maiúscula e a segunda minúscula.\nEx: Caio, matrícula 20200000000, CPF 123.456.789-10. E-mail: 20200000000@alunos.estacio.br Senha: 123456@Ca');
                break;

            case '9':
                await client.sendMessage(user, '📩 Dúvida fora da lista? Escreva sua dúvida que iremos encaminhar.');
                break;

            default:
                await client.sendMessage(user, 'Desculpe, essa opção não é válida. Por favor, escolha um número de 1 a 9.');
                return;
        }

        await chat.sendStateTyping(); await delay(7000);
        await delay(9000);
        await client.sendMessage(user, 'Você precisa de mais alguma coisa? (Responda com "Sim" ou "Não")');
        userState.set(user, 'pos-atendimento');
        return;
    }

    // === Tratamento de mensagens inesperadas fora do estado correto ===
    await client.sendMessage(user, 'Desculpa, não entendi. Certifique-se de escolher somente as opções válidas indicadas. Por favor, repita sua resposta conforme as instruções.');
});
