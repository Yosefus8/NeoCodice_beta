document.addEventListener('DOMContentLoaded', () => {

    // --- Desbloqueio de Áudio (Autoplay Policy) ---
    let audioContext;
    let audioUnlocked = false;

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        audioUnlocked = true;
        console.log("🔊 AudioContext desbloqueado");
    }

    // --- MODO DE DEBUG ---
    // Defina como 'true' para ver as caixas de colisão e coordenadas
    const DEBUG_MODE = false;
    // -------------------------

    // ---  CONFIGURAÇÕES E CONSTANTES ---
    const GAME_WIDTH = 1280;
    const GAME_HEIGHT = 720;
    const LIBRARY_PLAYER_SCALE = 1.5;

    // ---  REFERÊNCIAS AOS ELEMENTOS HTML ---
    const startScreen = document.getElementById('start-screen');
    const canvas = document.getElementById('gameCanvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    canvas.style.imageRendering = 'pixelated';
    let digitarTimer = null;
    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');
    const actionButton = document.getElementById('action-button');

    // --- SISTEMA DE ÁUDIO GLOBAL ---
    let reverbNode = null;

    // Pré-carrega e configura o reverb da livraria
    async function carregarReverb() {
        try {
            const response = await fetch(SONS.reverb);
            const arrayBuffer = await response.arrayBuffer();
            const impulse = await audioContext.decodeAudioData(arrayBuffer);
            const convolver = audioContext.createConvolver();
            convolver.buffer = impulse;
            return convolver;
        } catch (err) {
            console.warn("Reverb não pôde ser carregado:", err);
            return null;
        }
    }

    carregarReverb().then(node => reverbNode = node);

    const SONS = {
        porta: "audio/porta.wav",
        passos:
            "audio/passosMadeira.mp3",
        digitar:
            "audio/digitando.mp3",
        paginas: "audio/pagina.mp3"
    };

    let somDigitacao = null;

    function iniciarSomDigitacaoGlobal() {
        if (!audioUnlocked) return;
        if (somDigitacao && !somDigitacao.audio.paused) return; // já tocando

        if (!somDigitacao) {
            const audio = new Audio(SONS.digitar);
            const track = audioContext.createMediaElementSource(audio);
            const gain = audioContext.createGain();
            gain.gain.value = 0;
            track.connect(gain).connect(audioContext.destination);
            somDigitacao = { audio, gain };
            audio.loop = true;
        }

        somDigitacao.audio.currentTime = 0;
        somDigitacao.audio.play();
        const now = audioContext.currentTime;
        somDigitacao.gain.gain.cancelScheduledValues(now);
        somDigitacao.gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    }

    function pararSomDigitacaoGlobal() {
        if (!somDigitacao) return;
        const now = audioContext.currentTime;
        somDigitacao.gain.gain.cancelScheduledValues(now);
        somDigitacao.gain.gain.setValueAtTime(somDigitacao.gain.gain.value, now);
        somDigitacao.gain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
            if (somDigitacao && somDigitacao.audio) somDigitacao.audio.pause();
        }, 600);
    }

    function mostrarCenaComDialogo(imagemUrl, textoDialogo, callback = null) {
        isDialogOpen = true;
        initAudio();

        const canvasRect = canvas.getBoundingClientRect();

        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'absolute',
            left: `${canvasRect.left}px`,
            top: `${canvasRect.top}px`,
            width: `${canvasRect.width}px`,
            height: `${canvasRect.height}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '9999',
            backdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.6s ease'
        });
        canvas.parentElement.appendChild(container);

        const imagem = document.createElement('img');
        Object.assign(imagem.style, {
            maxWidth: '80%',
            maxHeight: '60%',
            borderRadius: '14px',
            boxShadow: '0 0 25px rgba(0,0,0,0.9)',
            objectFit: 'contain'
        });
        imagem.src = imagemUrl;
        container.appendChild(imagem);

        const faixa = document.createElement('div');
        Object.assign(faixa.style, {
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            padding: '25px',
            background: 'rgba(0, 60, 160, 0.8)',
            color: 'white',
            fontFamily: "'Press Start 2P', cursive",
            fontSize: '14px',
            textAlign: 'center',
            borderRadius: '12px 12px 0 0',
            boxShadow: '0 -2px 20px rgba(0,0,0,0.5)',
            minHeight: '80px',
            whiteSpace: 'pre-line'
        });
        container.appendChild(faixa);

        let i = 0;
        let textoCompleto = false;
        let digitarTimer = null;

        function digitarTexto() {
            if (i === 0) iniciarSomDigitacaoGlobal();
            if (i < textoDialogo.length) {
                faixa.innerText = textoDialogo.substring(0, i + 1);
                i++;
                digitarTimer = setTimeout(digitarTexto, 40);
            } else {
                textoCompleto = true;
                pararSomDigitacaoGlobal();
                faixa.innerText = textoDialogo + "\n\n(Pressione Enter ou E para continuar)";
            }
        }

        function fechar() {
            clearTimeout(digitarTimer);
            document.removeEventListener('keydown', skipDialogue);
            container.remove();
            isDialogOpen = false;
            if (callback) callback();
        }

        // garante que apenas um listener de tecla está ativo por diálogo
        function skipDialogue(event) {
            const tecla = event.key?.toLowerCase();
            if (tecla === 'enter' || tecla === 'e') {
                event.stopPropagation();
                if (!textoCompleto) {
                    clearTimeout(digitarTimer);
                    textoCompleto = true;
                    faixa.innerText = textoDialogo + "\n\n(Pressione Enter ou E para continuar)";
                    pararSomDigitacaoGlobal();
                } else {
                    fechar();
                }
            }
        }

        document.removeEventListener('keydown', skipDialogue); // 🔥 previne acúmulo
        document.addEventListener('keydown', skipDialogue, { once: false });

        digitarTexto();
    }


    function transicaoParaEgitoComCena() {
        if (isLoadingLevel) {
            console.warn('[EGITO] isLoadingLevel estava travado como TRUE — resetando estado.');
            isLoadingLevel = false; // força o reset
        }

        // Reinicia estados para garantir carregamento
        isLoadingLevel = true;
        isDialogOpen = true;
        initAudio(); // garante áudio desbloqueado

        console.log('[TRANSIÇÃO] Iniciando transição cinematográfica para o Egito...');
        // Cria overlay preto
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            background: 'black',
            opacity: '0',
            transition: 'opacity 1.5s ease',
            zIndex: '99999'
        });
        document.body.appendChild(overlay);

        // Escurece a tela
        requestAnimationFrame(() => overlay.style.opacity = '1');

        // Aguarda a transição escurecer e carrega o mapa
        setTimeout(() => {
            console.log('[TRANSIÇÃO] Carregando mapa do Egito...');
            setTimeout(() => {
                // garante que loadLevel não retorne por causa da guarda isLoadingLevel
                isLoadingLevel = false;
                if (brilhoLivro) {
                    brilhoLivro.remove();
                    brilhoLivro = null;
                    console.log('[LIVRO] Brilho removido antes da transição.');
                }
                loadLevel('egypt');
            }, 10);

            // Garante que o level atual foi definido corretamente
            currentLevelId = 'egypt';

            // Suaviza o fade de volta
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 1200);
            }, 1200);

            // Mostra a cena de introdução após o mapa carregar
            setTimeout(() => {
                mostrarCenaComDialogoCor(
                    'img/egito_dialogo.png',
                    'O que foi isso?! Parece que fui transportado para dentro do livro...',
                    'rgba(0, 60, 160, 0.8)',
                    () => {
                        iniciarTremorTela(800);

                        // Voz misteriosa surge
                        setTimeout(() => {
                            mostrarCenaComDialogoCor(
                                'img/diavm1.png',
                                'Voz Misteriosa:\n“Encontre o tesouro perdido... e resgate o que foi uma vez esquecido.”',
                                'rgba(160, 0, 0, 0.8)',
                                () => {
                                    // Jogador responde
                                    setTimeout(() => {
                                        mostrarCenaComDialogoCor(
                                            'img/egito_dialogo.png',
                                            'O que? Tesouro perdido? Onde eu vou encontrar isso?',
                                            'rgba(0, 60, 160, 0.8)',
                                            () => {
                                                console.log('[TRANSIÇÃO] Cena do Egito concluída.');
                                                isDialogOpen = false;
                                                isLoadingLevel = false;
                                            }
                                        );
                                    }, 500);
                                }
                            );
                        }, 1800);
                    }
                );
            }, 2000);
        }, 1200);
    }


    function mostrarCenaComDialogoCor(
        imagemUrl,
        textoDialogo,
        corFaixa = 'rgba(0, 60, 160, 0.8)',
        callback = null
    ) {
        isDialogOpen = true;
        let digitarTimer; // ✅ definido corretamente aqui

        const canvasRect = canvas.getBoundingClientRect();
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'absolute',
            left: `${canvasRect.left}px`,
            top: `${canvasRect.top}px`,
            width: `${canvasRect.width}px`,
            height: `${canvasRect.height}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '9999',
            backdropFilter: 'blur(3px)',
        });
        canvas.parentElement.appendChild(container);

        const imagem = document.createElement('img');
        Object.assign(imagem.style, {
            maxWidth: '80%',
            maxHeight: '60%',
            borderRadius: '14px',
            boxShadow: '0 0 25px rgba(0,0,0,0.9)',
            objectFit: 'contain',
        });
        imagem.src = imagemUrl;
        container.appendChild(imagem);

        const faixa = document.createElement('div');
        Object.assign(faixa.style, {
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            padding: '25px',
            background: corFaixa,
            color: 'white',
            fontFamily: "'Press Start 2P', cursive",
            fontSize: '14px',
            textAlign: 'center',
            borderRadius: '12px 12px 0 0',
            boxShadow: '0 -2px 20px rgba(0,0,0,0.5)',
            minHeight: '80px',
            whiteSpace: 'pre-line'
        });
        container.appendChild(faixa);

        let i = 0;
        let textoCompleto = false;

        // Digitação animada
        function digitarTexto() {
            if (i === 0 && typeof iniciarSomDigitacaoGlobal === 'function')
                iniciarSomDigitacaoGlobal();

            if (i < textoDialogo.length) {
                faixa.innerText = textoDialogo.substring(0, i + 1);
                i++;
                digitarTimer = setTimeout(digitarTexto, 40);
            } else {
                textoCompleto = true;
                if (typeof pararSomDigitacaoGlobal === 'function')
                    pararSomDigitacaoGlobal();
                faixa.innerText = textoDialogo + "\n\n(Pressione Enter ou E para continuar)";
            }
        }

        // Fecha o diálogo
        function fechar() {
            clearTimeout(digitarTimer);
            document.removeEventListener('keydown', skipDialogue);
            container.remove();
            isDialogOpen = false;
            if (callback) callback(); // garante a continuação
        }

        // Captura tecla E ou Enter
        function skipDialogue(event) {
            const tecla = event.key?.toLowerCase();
            if (tecla === 'enter' || tecla === 'e') {
                event.stopPropagation();

                if (!textoCompleto) {
                    // Pula a digitação imediatamente
                    clearTimeout(digitarTimer);
                    textoCompleto = true;
                    faixa.innerText = textoDialogo + "\n\n(Pressione Enter ou E para continuar)";
                    if (typeof pararSomDigitacaoGlobal === 'function')
                        pararSomDigitacaoGlobal();
                } else {
                    // Fecha o diálogo normalmente
                    fechar();
                }
            }
        }

        document.addEventListener('keydown', skipDialogue);
        digitarTexto();
    }

    function iniciarTremorTela(duracao = 800) {
        const canvasContainer = canvas.parentElement;
        let start = performance.now();

        function tremer(timestamp) {
            const elapsed = timestamp - start;
            const intensidade = Math.max(0, 8 - (elapsed / duracao) * 8);
            const x = (Math.random() - 0.5) * intensidade;
            const y = (Math.random() - 0.5) * intensidade;
            canvasContainer.style.transform = `translate(${x}px, ${y}px)`;

            if (elapsed < duracao) {
                requestAnimationFrame(tremer);
            } else {
                canvasContainer.style.transform = 'translate(0, 0)';
            }
        }

        requestAnimationFrame(tremer);
    }

    let questAtiva = null;
    let questPerguntas = [
        {
            pergunta: 'Sou feito de pedra, volto ao céu em linha reta, tenho corredores que sussurram história secreta. Aponto para as estrelas e guardo um passado real —quem sou eu, guardião do sarcófago e do sinal?',
            resposta: 'pirâmide',
            premio: 'Pedra',
        },
        {
            pergunta: 'Tenho o corpo de leão e a cabeça de homem. Quem sou?',
            resposta: 'esfinge',
            premio: 'Uma joia de ouro reluzente',
        },
        {
            pergunta: 'Sou um rio que corta o deserto e dá vida às margens. Qual é o meu nome?',
            resposta: 'nilo',
            premio: 'Água',
        }
    ];
    const questPerguntasJapao = [
        {
            id: 'jp_q1',
            pergunta: 'Sou curva e mortal, de aço e respeito. Na mão do samurai, sou seu amuleto. Quem sou eu?',
            resposta: 'katana',
            premio: 'Sabedoria dos Samurais'
        },
        {
            id: 'jp_q2',
            pergunta: 'Sem cavalo, sem som, cruzo muralhas na sombra. Meu rosto ninguém vê, mas o medo me acompanha. Quem sou eu?',
            resposta: 'ninja',
            premio: 'Arte furtiva'
        },
        {
            id: 'jp_q3',
            pergunta: 'Sou sombra do trono, mas comando o exército inteiro. Enquanto o sol governa o céu, eu domino o guerreiro. Quem sou eu?',
            resposta: 'Shogun',
            premio: 'Comandante supremo'
        }
    ];

    function iniciarQuestEgito(idLocal) {
        if (questAtiva || isDialogOpen) return; // evita sobreposição
        questAtiva = true;
        isDialogOpen = true;

        const nivel = levels['egypt'];
        const interativo = nivel.interactables.find(i => i.id === idLocal);
        if (!interativo || !interativo.active || interativo.concluida || interativo.bloqueado) {
            console.warn(`[QUEST] Local ${idLocal} inválido ou bloqueado.`);
            questAtiva = false;
            isDialogOpen = false;
            return;
        }

        // Guarda o último local interagido
        ultimoLocalInteragido = idLocal;

        // Escolhe uma charada aleatória
        // Escolhe uma charada aleatória sem repetir
        // Escolhe uma charada aleatória sem repetir (somente do Egito)
        let questDisponiveis = questPerguntas.filter(q => !questPerguntasUsadasEgito.includes(q.pergunta));

        if (questDisponiveis.length === 0) {
            console.warn('[QUEST] Todas as perguntas do Egito já foram usadas. Reiniciando lista.');
            questPerguntasUsadasEgito = [];
            questDisponiveis = [...questPerguntas];
        }

        const quest = questDisponiveis[Math.floor(Math.random() * questDisponiveis.length)];
        questPerguntasUsadasEgito.push(quest.pergunta);


        mostrarCenaComDialogoCor(
            'img/papiro_dialogo.png',
            `Voz Misteriosa:\n\n"${quest.pergunta}"\n\n(Responda digitando abaixo)`,
            'rgba(160, 0, 0, 0.8)',
            () => {
                criarCaixaResposta(quest);
            }
        );
    }

    function iniciarQuestJapao(localId) {
        if (questAtiva || isDialogOpen) return;
        questAtiva = true;
        isDialogOpen = true;

        const nivel = levels['japan'];
        const interativo = nivel.interactables.find(i => i.id === localId);
        if (!interativo || !interativo.active || interativo.concluida || interativo.bloqueado) {
            console.warn(`[QUEST] Local ${localId} inválido ou bloqueado.`);
            questAtiva = false;
            isDialogOpen = false;
            return;
        }

        // guarda o último local interagido
        ultimoLocalInteragido = localId;

        // usa a lista global de perguntas usadas (precisa existir no topo do script)
        // let questPerguntasUsadasJapao = [];
        let questDisponiveis = questPerguntasJapao.filter(q => !questPerguntasUsadasJapao.includes(q.pergunta));

        // se todas as perguntas já foram usadas, reseta
        if (questDisponiveis.length === 0) {
            console.warn('[QUEST JAPÃO] Todas as perguntas já foram usadas. Reiniciando lista.');
            questPerguntasUsadasJapao = [];
            questDisponiveis = [...questPerguntasJapao];
        }

        // escolhe uma pergunta aleatória
        const quest = questDisponiveis[Math.floor(Math.random() * questDisponiveis.length)];
        questPerguntasUsadasJapao.push(quest.pergunta);

        // mostra o diálogo
        mostrarCenaComDialogoCor(
            'img/papiro_japao.png',
            `Voz Misteriosa:\n\n"${quest.pergunta}"\n\n(Responda digitando abaixo)`,
            'rgba(0, 0, 160, 0.8)', // azul japonês
            () => {
                criarCaixaRespostaJapao(quest);
            }
        );
    }


    function criarCaixaResposta(quest) {
        const inputBox = document.createElement('div');
        inputBox.style.position = 'absolute';
        inputBox.style.top = '60%';
        inputBox.style.left = '50%';
        inputBox.style.transform = 'translate(-50%, -50%)';
        inputBox.style.background = 'rgba(0,0,0,0.8)';
        inputBox.style.padding = '20px';
        inputBox.style.borderRadius = '10px';
        inputBox.style.zIndex = '10000';
        inputBox.style.textAlign = 'center';
        inputBox.style.fontFamily = "'Press Start 2P', cursive";

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Digite sua resposta...';
        input.style.padding = '10px';
        input.style.fontFamily = "'Press Start 2P', cursive";
        input.style.width = '300px';
        input.style.textAlign = 'center';
        input.style.textTransform = 'lowercase';
        inputBox.appendChild(input);

        const btn = document.createElement('button');
        btn.innerText = 'Responder';
        btn.style.marginTop = '15px';
        btn.style.padding = '8px 12px';
        btn.style.border = 'none';
        btn.style.background = 'rgba(0,60,160,0.8)';
        btn.style.color = 'white';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        btn.onclick = () => validarRespostaQuest(input.value.trim(), quest, inputBox);
        inputBox.appendChild(document.createElement('br'));
        inputBox.appendChild(btn);

        // Permite responder com Enter
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                validarRespostaQuest(input.value.trim(), quest, inputBox);
            }
        });

        document.body.appendChild(inputBox);
        input.focus();
    }

    function criarCaixaRespostaJapao(quest) {
        criarCaixaResposta(quest); // usa a função existente
    }



    function validarRespostaQuest(resposta, quest, inputBox) {
        inputBox.remove();

        const nivel = levels[currentLevelId];
        const interativo = nivel.interactables.find(i => i.id === ultimoLocalInteragido);

        if (!interativo) return;

        // Normaliza estados
        interativo.active = false;
        interativo.bloqueado = true;
        interativo.errouUltima = false;

        if (respostaEstaCorreta(resposta, quest.resposta)) {
            // Acertou
            interativo.concluida = true;
            questAtiva = false;

            // Imagem e cor variam conforme o mapa atual
            const imgVitoria = currentLevelId === 'japan' ? 'img/japao_vitoria.png' : 'img/egito_vitoria.png';
            const corVitoria = currentLevelId === 'japan' ? 'rgba(0, 0, 160, 0.8)' : 'rgba(0, 120, 0, 0.8)';

            mostrarCenaComDialogoCor(
                imgVitoria,
                `Você acertou!\n\n${quest.premio || ''}`,
                corVitoria,
                () => {
                    console.log(`[QUEST] ${interativo.id} concluída com sucesso.`);
                    isDialogOpen = false;
                    moverQuestParaOutroLocal(interativo.id); // libera os outros

                    // Chama a verificação correta conforme o mapa
                    if (currentLevelId === 'egypt') {
                        verificarTodasQuestsConcluidas();
                    } else if (currentLevelId === 'japan') {
                        verificarTodasQuestsConcluidasJapao();
                    }
                }
            );
        } else {
            // Errou
            interativo.errouUltima = true;
            questAtiva = false;

            // Imagem e cor de derrota variam conforme o mapa atual
            const imgDerrota = currentLevelId === 'japan' ? 'img/japao_derrota.png' : 'img/egito_derrota.png';
            const corDerrota = currentLevelId === 'japan' ? 'rgba(160, 0, 0, 0.8)' : 'rgba(160, 0, 0, 0.8)';

            mostrarCenaComDialogoCor(
                imgDerrota,
                `Voz Misteriosa:\n\n"Errado, mortal... procure outro local..."`,
                corDerrota,
                () => {
                    moverQuestParaOutroLocal(interativo.id); // libera os outros também
                    isDialogOpen = false;
                    console.log(`[QUEST] ${interativo.id} marcada como errada.`);
                }
            );
        }
    }

    function verificarTodasQuestsConcluidas() {
        const nivel = levels[currentLevelId];
        if (!nivel || !nivel.interactables) return;

        const total = nivel.interactables.length;
        const concluidas = nivel.interactables.filter(i => i.concluida).length;

        console.log(`[QUEST] ${concluidas}/${total} charadas concluídas no nível ${currentLevelId}.`);

        // Todas concluídas
        if (concluidas >= total) {
            setTimeout(() => {
                if (currentLevelId === 'egypt') {
                    mostrarCenaComDialogoCor(
                        'img/egito_vitoria.png',
                        'Parabéns! \nVocê respondeu todas as charadas e o portal da pirâmide está aberto!\n\nSiga até a pirâmide para continuar sua jornada.',
                        'rgba(200,180,0,0.85)',
                        () => {
                            console.log('[QUEST] Todas as quests do Egito concluídas!');
                            tocarSom(SONS.vitoria, 0.8, false);

                            ativarPortalPiramide();

                            destacarPortalEgitoComLuz();

                            isDialogOpen = false;
                        }
                    );
                } else if (currentLevelId === 'japan') {
                    mostrarCenaComDialogoCor(
                        'img/japao_vitoria.png',
                        'Você desvendou os enigmas do Japão! 🇯🇵\n\nO equilíbrio entre passado e presente começa a se restaurar...',
                        'rgba(160,0,0,0.85)',
                        () => {
                            console.log('[QUEST] Todas as quests do Japão concluídas!');
                            tocarSom(SONS.vitoria, 0.8, false);

                            //  Ativa o portal de retorno à biblioteca
                            const portalJapao = nivel.interactables?.find(i => i.id === 'portal_biblioteca');
                            if (portalJapao) {
                                portalJapao.active = true;
                                console.log('[PORTAL JAPÃO] Portal para biblioteca ativado!');
                            }

                            //  Cria o destaque visual do portal
                            destacarPortalJapao();

                            //  Mensagem adicional
                            setTimeout(() => {
                                mostrarCenaComDialogoCor(
                                    'img/portal_biblio.png',
                                    'Uma voz misteriosa sussurra:\n\n"Redescobriste o conhecimento perdido... siga pela luz e retorna à origem."',
                                    'rgba(0, 60, 160, 0.8)'
                                );
                            }, 800);

                            isDialogOpen = false;
                        }
                    );
                }
                else {
                    mostrarCenaComDialogoCor(
                        'img/vitoria_padrao.png',
                        'Você completou todas as tarefas deste local!',
                        'rgba(0,120,200,0.85)',
                        () => {
                            console.log(`[QUEST] Todas as quests concluídas no nível ${currentLevelId}.`);
                            tocarSom(SONS.vitoria, 0.8, false);
                            isDialogOpen = false;
                        }
                    );
                }
            }, 800);
        }
    }

    let questsConcluidasJapao = 0;
    let portalJapaoAtivo = false;

    function verificarTodasQuestsConcluidasJapao() {
        const nivel = levels['japan'];
        const todasConcluidas = nivel.interactables.every(i => i.concluida);

        if (todasConcluidas && !portalJapaoAtivo) {
            portalJapaoAtivo = true;
            console.log('[PORTAL] Todas as quests do Japão concluídas.');

            // Primeiro diálogo da Voz Misteriosa
            mostrarCenaComDialogoCor(
                'img/papiro_japao.png',
                'Voz Misteriosa:\n\n"Conseguiste... redescobrir o conhecimento perdido. Teu espírito ainda ecoa entre eras..."',
                'rgba(0, 0, 160, 0.8)',
                () => {
                    // Após o diálogo, ativa o portal
                    const portalJapao = {
                        id: 'portal_biblioteca',
                        x: 1053, y: 585, width: 40, height: 40,
                        active: true,
                        action: () => iniciarTransicaoBiblioteca()
                    };

                    nivel.interactables.push(portalJapao);
                    console.log('[PORTAL] Portal da biblioteca criado no Japão.');

                    //  Luz de destaque no portal
                    destacarPortalJapao();

                    // Diálogo breve: portal surgiu
                    mostrarCenaComDialogoCor(
                        'img/portal_ativo.png',
                        'Uma força misteriosa se manifesta diante de ti...\n\nUm portal surge.',
                        'rgba(0, 60, 160, 0.8)'
                    );
                }
            );
        }
    }


    function ativarPortalJapaoBiblioteca() {
        const nivel = levels['japan'];
        const portal = nivel.interactables.find(i => i.id === 'portal_library');
        if (portal) {
            portal.active = true;
            console.log('[PORTAL] Portal de volta à biblioteca ativado no Japão!');
        }
    }



    function ativarPortalPiramide() {
        const nivel = levels['egypt'];
        if (!nivel) return;

        // Se já existir, não duplica
        if (nivel.interactables.find(i => i.id === 'portal_egito_japao')) return;

        // Adiciona o portal como novo ponto interativo
        nivel.interactables.push({
            id: 'portal_egito_japao',
            x: 768, y: 232, width: 80, height: 58, // coordenadas da pirâmide
            active: true,
            isPortal: true,
            action: () => iniciarTransicaoJapao()
        });

        console.log('[PORTAL] Pirâmide ativada como portal para o Japão!');
    }
    let brilhoPortalEgito = null;
    function destacarPortalEgitoComLuz() {
        if (brilhoPortalEgito) return; // já ativo

        brilhoPortalEgito = document.createElement('div');
        brilhoPortalEgito.style.position = 'absolute';
        brilhoPortalEgito.style.width = '120px';
        brilhoPortalEgito.style.height = '120px';
        brilhoPortalEgito.style.borderRadius = '50%';
        brilhoPortalEgito.style.background = 'radial-gradient(rgba(255,255,180,0.8), rgba(255,255,0,0))';
        brilhoPortalEgito.style.pointerEvents = 'none';
        brilhoPortalEgito.style.zIndex = '5000';
        brilhoPortalEgito.style.animation = 'pulsarLuz 1.5s infinite ease-in-out';
        document.body.appendChild(brilhoPortalEgito);

        // posição do portal no Egito (ajuste conforme teu mapa)
        const portalMundo = { x: 810, y: 254 }; // 🏺 coordenadas aproximadas da pirâmide

        function atualizarPosicao() {
            const canvasRect = canvas.getBoundingClientRect();
            const offsetX = (portalMundo.x - camera.x) * (canvasRect.width / canvas.width);
            const offsetY = (portalMundo.y - camera.y) * (canvasRect.height / canvas.height);

            brilhoPortalEgito.style.left = `${canvasRect.left + offsetX - 60}px`;
            brilhoPortalEgito.style.top = `${canvasRect.top + offsetY - 60}px`;

            if (brilhoPortalEgito) requestAnimationFrame(atualizarPosicao);
        }

        atualizarPosicao();

        console.log('[PORTAL] Efeito de destaque do Egito ativado.');
    }


    function iniciarTransicaoJapao() {
        if (isLoadingLevel) return;
        isLoadingLevel = true;
        isDialogOpen = true;

        console.log('[TRANSIÇÃO] Iniciando transição para o Japão...');

        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            opacity: '0',
            transition: 'opacity 1.5s ease',
            zIndex: '9999',
        });
        document.body.appendChild(overlay);

        // 🔄 Escurecimento suave
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        // Após escurecer completamente
        setTimeout(() => {
            //  Remove o brilho do portal do Egito (caso ainda esteja ativo)
            if (typeof brilhoPortalEgito !== 'undefined' && brilhoPortalEgito) {
                brilhoPortalEgito.remove();
                brilhoPortalEgito = null;
                console.log('[PORTAL EGITO] Efeito de destaque removido.');
            }

            mostrarCenaComDialogoCor(
                'img/portal_japao.png',
                'Uma luz intensa te envolve... e o mundo ao redor muda completamente.',
                'rgba(0, 60, 160, 0.8)',
                () => {
                    console.log('[TRANSIÇÃO] Carregando Japão...');

                    // Garante que o carregamento está liberado
                    isDialogOpen = false;
                    isLoadingLevel = false;
                    if (startScreen) startScreen.style.display = 'none';

                    //  Carrega o novo mapa
                    loadLevel('japan');

                    // Suaviza o desaparecimento do overlay
                    overlay.style.transition = 'opacity 2s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 2000);

                    //  Reinicia o loop se necessário
                    if (!isGameLoopRunning) {
                        isGameLoopRunning = true;
                        requestAnimationFrame(gameLoop);
                    }

                    console.log('[TRANSIÇÃO] Transição para o Japão concluída.');

                    // Após o carregamento, exibe o diálogo inicial do Japão
                    setTimeout(() => {
                        mostrarCenaJapaoIntro();
                    }, 1500);
                }
            );
        }, 1600);
    }


    function ativarPortalBiblioteca() {
        if (isDialogOpen || isLoadingLevel) return;

        console.log('[PORTAL] Ativando portal de retorno à biblioteca...');
        isDialogOpen = true;
        isLoadingLevel = true;

        //  Mostra diálogo inicial de ativação
        mostrarCenaComDialogoCor(
            'img/portal_library.png',
            'O portal começa a brilhar intensamente... a mesma energia do livro ecoa nele.',
            'rgba(0, 60, 160, 0.8)',
            () => iniciarTransicaoBiblioteca()
        );
    }

    function iniciarTransicaoBiblioteca() {
        console.log('[TRANSIÇÃO] Iniciando retorno à biblioteca...');

        // Remove o brilho do portal (caso ainda esteja ativo)
        if (brilhoPortalJapao) {
            brilhoPortalJapao.remove();
            brilhoPortalJapao = null;
            console.log('[PORTAL] Efeito de destaque removido.');
        }

        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            opacity: '0',
            transition: 'opacity 1.5s ease',
            zIndex: '9999',
        });
        document.body.appendChild(overlay);

        // Escurece a tela
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        // Após escurecer, mostra o diálogo e muda o mapa
        setTimeout(() => {
            mostrarCenaComDialogoCor(
                'img/livrobt.png',
                'Uma luz azul te envolve novamente... e o som familiar das páginas ecoa.',
                'rgba(0, 60, 160, 0.8)',
                () => {
                    console.log('[TRANSIÇÃO] Carregando biblioteca...');
                    isDialogOpen = false;
                    isLoadingLevel = false;
                    if (startScreen) startScreen.style.display = 'none';

                    // Carrega o mapa da biblioteca
                    loadLevel('library');

                    //  Dissolve o overlay suavemente
                    overlay.style.transition = 'opacity 2s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 2000);

                    if (!isGameLoopRunning) {
                        isGameLoopRunning = true;
                        requestAnimationFrame(gameLoop);
                    }

                    console.log('[TRANSIÇÃO] Retorno à biblioteca concluído.');

                    // 💬 1️⃣ Primeira fala da voz misteriosa
                    setTimeout(() => {
                        mostrarCenaComDialogoCor(
                            'img/livrobt.png',
                            'Voz Misteriosa:\n\n"As páginas não estavam vazias... o mundo é que havia esquecido suas histórias."',
                            'rgba(0, 60, 160, 0.8)',
                            () => {
                                //  Segunda fala da voz misteriosa
                                mostrarCenaComDialogoCor(
                                    'img/livrobt.png',
                                    'Voz Misteriosa:\n\n"Enquanto houver quem leia, quem conte e quem preserve... nenhuma história se perde."',
                                    'rgba(0, 60, 160, 0.8)',
                                    () => {
                                        // Reflexão final do protagonista
                                        mostrarCenaComDialogoCor(
                                            'img/livrobt.png',
                                            'Você:\n\n"Então é isso... os livros não guardam só palavras. Eles guardam o que somos."',
                                            'rgba(0, 60, 160, 0.8)',
                                            () => {
                                                console.log('[FINAL] Mensagem final concluída.');
                                                encerrarJogo(); //  encerra o jogo
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }, 2000);
                }
            );
        }, 1600);
    }

    function encerrarJogo() {
        console.log('[FIM DE JOGO] Iniciando fade final...');

        // Fundo preto que cobre toda a tela
        const fadeFinal = document.createElement('div');
        Object.assign(fadeFinal.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            opacity: '0',
            transition: 'opacity 2.5s ease',
            zIndex: '99999',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            color: 'white',
            fontFamily: "'Press Start 2P', cursive",
            textAlign: 'center',
            padding: '20px',
        });
        document.body.appendChild(fadeFinal);

        // Frase de encerramento
        const frase = document.createElement('div');
        frase.innerHTML = `
        <p style="
            font-size: 16px;
            max-width: 700px;
            line-height: 1.6;
            text-shadow: 0 0 10px rgba(255,255,255,0.3);
        ">
            "A leitura é, provavelmente, uma outra maneira de estar em um lugar"<br>
            <span style="font-size:12px; opacity:0.8;">– José Saramago</span>
        </p>
    `;
        frase.style.opacity = '0';
        frase.style.transition = 'opacity 2s ease';
        fadeFinal.appendChild(frase);

        // Mensagem de agradecimento
        const agradecimento = document.createElement('div');
        agradecimento.innerHTML = `
        <p style="
            font-size: 14px;
            margin-top: 40px;
            color: rgba(255,255,255,0.9);
            text-shadow: 0 0 10px rgba(255,255,255,0.3);
        ">
            Obrigado por jogar<br><strong>NeoCodice (Versão Beta)</strong>
        </p>
    `;
        agradecimento.style.opacity = '0';
        agradecimento.style.transition = 'opacity 2s ease';
        fadeFinal.appendChild(agradecimento);

        // Sequência de animação
        // 1️ Escurece a tela
        requestAnimationFrame(() => {
            fadeFinal.style.opacity = '1';
        });

        // 2️ Mostra a frase de Saramago
        setTimeout(() => {
            frase.style.opacity = '1';
        }, 2500);

        // 3️ Após alguns segundos, mostra o "Obrigado por jogar"
        setTimeout(() => {
            agradecimento.style.opacity = '1';
        }, 7000);

        // 4️ Aguarda alguns segundos, depois fade out de tudo e retorno ao menu
        setTimeout(() => {
            frase.style.transition = 'opacity 2.5s ease';
            agradecimento.style.transition = 'opacity 2.5s ease';
            frase.style.opacity = '0';
            agradecimento.style.opacity = '0';

            // 5️ Retorna à tela inicial
            setTimeout(() => {
                fadeFinal.remove();
                startScreen.style.display = 'flex';
                startScreen.innerHTML = `
                <div style="text-align:center;">
                    <h1 style="font-family:'Press Start 2P', cursive; color:white; text-shadow:0 0 10px black;">
                        A HISTÓRIA CONTINUA...
                    </h1>
                    <p style="color:white; margin-top:20px;">
                        Pressione qualquer tecla para jogar novamente
                    </p>
                </div>
            `;
                isGameLoopRunning = false;
                isDialogOpen = false;

                const reiniciar = () => {
                    document.removeEventListener('keydown', reiniciar);
                    startScreen.style.display = 'none';
                    loadLevel('library');
                };
                document.addEventListener('keydown', reiniciar);
            }, 3000);
        }, 11000); // Tempo total ~11s (frase + agradecimento)
    }


    function mostrarCenaJapaoIntro() {
        console.log("[JAPÃO] Iniciando diálogo introdutório...");
        isDialogOpen = true;

        mostrarCenaComDialogoCor(
            "img/portal_japao.png",
            "Parece que estou no Japão, mas numa época bem diferente da atual... isso é incrível, mas não entendo o porquê estou aqui ainda.",
            "rgba(0, 60, 160, 0.8)",
            () => {
                // efeito de tremor
                const canvas = document.getElementById("gameCanvas");
                const style = document.createElement("style");
                style.innerHTML = `
                @keyframes tremor {
                    0%, 100% { transform: translate(0, 0); }
                    20% { transform: translate(-5px, 3px); }
                    40% { transform: translate(5px, -3px); }
                    60% { transform: translate(-4px, 2px); }
                    80% { transform: translate(4px, -2px); }
                }`;
                document.head.appendChild(style);
                canvas.style.animation = "tremor 0.5s ease-in-out 3";

                setTimeout(() => {
                    mostrarCenaComDialogoCor(
                        "img/japao_vozmisteriosa.png",
                        'Voz Misteriosa:\n\n"Mais uma vez cabe a ti, e só a ti, ser o farol que varre a névoa dos ontens, o mergulhador que desce ao abismo do tempo."',
                        "rgba(160, 0, 0, 0.8)",
                        () => {
                            mostrarCenaComDialogoCor(
                                "img/japao_intro.png",
                                "Ei, espere, o que quer dizer com isso?",
                                "rgba(0, 60, 160, 0.8)",
                                () => {
                                    mostrarCenaComDialogoCor(
                                        "img/japao_intro.png",
                                        ".... (a voz misteriosa se mantém em silêncio)",
                                        "rgba(160, 0, 0, 0.8)",
                                        () => {
                                            console.log("[JAPÃO] Diálogo inicial concluído.");
                                            isDialogOpen = false;
                                        }
                                    );
                                }
                            );
                        }
                    );
                }, 1000);
            }
        );
    }

    function respostaEstaCorreta(respostaDigitada, respostaCorreta) {
        if (!respostaDigitada || !respostaCorreta) return false;

        // Normaliza tudo para minúsculas e sem acentos
        const normalizar = (str) => str
            .toLowerCase()
            .normalize('NFD') // remove acentos
            .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
            .replace(/[^a-z0-9\s]/g, '') // remove símbolos
            .trim();

        const r1 = normalizar(respostaDigitada);
        const r2 = normalizar(respostaCorreta);

        // Remove palavras irrelevantes (artigos, preposições etc.)
        const removerPalavrasComuns = (texto) => texto
            .split(/\s+/)
            .filter(p => !['o', 'a', 'os', 'as', 'um', 'uma', 'é', 'sou', 'sou um', 'sou uma', 'do', 'da', 'de', 'no', 'na', 'rio'].includes(p))
            .join(' ');

        const limp1 = removerPalavrasComuns(r1);
        const limp2 = removerPalavrasComuns(r2);

        // Plural: considera "pirâmide" = "pirâmides"
        if (limp1 === limp2) return true;
        if (limp1 === limp2 + 's' || limp1 + 's' === limp2) return true;

        // Aproximação parcial (caso o jogador escreva mais palavras)
        if (limp1.includes(limp2) || limp2.includes(limp1)) return true;

        //  Similaridade por distância de Levenshtein (tolerância a erros de digitação)
        return similaridade(limp1, limp2) >= 0.75;
    }

    function similaridade(a, b) {
        if (!a || !b) return 0;
        const m = [];
        for (let i = 0; i <= b.length; i++) { m[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { m[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                m[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                    ? m[i - 1][j - 1]
                    : Math.min(m[i - 1][j - 1] + 1, Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1));
            }
        }
        const dist = m[b.length][a.length];
        return 1 - dist / Math.max(a.length, b.length);
    }

    let ultimoLocalInteragido = null;

    function moverQuestParaOutroLocal(idAnterior = null) {
        const nivel = levels[currentLevelId];
        if (!nivel || !nivel.interactables) return;

        console.log(`[QUEST] Movendo quest no nível: ${currentLevelId}`);

        // Bloqueia apenas o ponto anterior
        if (idAnterior) {
            const anterior = nivel.interactables.find(i => i.id === idAnterior);
            if (anterior) {
                anterior.active = false;
                anterior.bloqueado = true;
                anterior.errouUltima = true;
                console.log(`[QUEST] ${idAnterior} bloqueado temporariamente.`);
            }
        }

        // Libera todos os outros pontos não concluídos
        nivel.interactables.forEach(i => {
            if (!i.concluida && i.id !== idAnterior) {
                i.active = true;
                i.bloqueado = false;
                i.errouUltima = false;
            }
        });

        // Escolhe novo local aleatório apenas para manter rotação viva
        const candidatos = nivel.interactables.filter(i =>
            !i.concluida && !i.bloqueado
        );

        if (candidatos.length > 0) {
            const novo = candidatos[Math.floor(Math.random() * candidatos.length)];
            novo.active = true;
            console.log(`[QUEST] Novo local ativo: ${novo.id}`);
        } else {
            console.warn('[QUEST] Nenhum local disponível, resetando todos...');
            nivel.interactables.forEach(i => {
                if (!i.concluida) {
                    i.active = true;
                    i.bloqueado = false;
                    i.errouUltima = false;
                }
            });
        }
    }

    function criarPortalBibliotecaJapao() {
        const nivel = levels['japan'];

        // evita duplicar
        if (nivel.interactables.some(i => i.id === 'portal_biblioteca')) return;

        nivel.interactables.push({
            id: 'portal_biblioteca',
            x: 1050, // ajuste a posição
            y: 592,
            width: 40,
            height: 40,
            active: true,
            concluida: false,
            errouUltima: false,
            bloqueado: false,
            action: () => iniciarTransicaoBiblioteca()
        });

        console.log('[PORTAL] Portal para biblioteca criado no Japão!');
    }
    let brilhoPortalJapao = null; // variável global (adicione fora de qualquer função)

    function destacarPortalJapao() {
        if (brilhoPortalJapao) return; // evita criar mais de um

        brilhoPortalJapao = document.createElement('div');
        brilhoPortalJapao.style.position = 'absolute';
        brilhoPortalJapao.style.width = '120px';
        brilhoPortalJapao.style.height = '120px';
        brilhoPortalJapao.style.borderRadius = '50%';
        brilhoPortalJapao.style.background = 'radial-gradient(rgba(100,150,255,0.9), rgba(0,0,255,0))';
        brilhoPortalJapao.style.pointerEvents = 'none';
        brilhoPortalJapao.style.zIndex = '5000';
        brilhoPortalJapao.style.animation = 'pulsarLuzPortal 1.5s infinite ease-in-out';
        document.body.appendChild(brilhoPortalJapao);

        const portalMundo = { x: 1065, y: 610 };

        function atualizarPosicao() {
            if (!brilhoPortalJapao) return; // já removido
            const canvasRect = canvas.getBoundingClientRect();
            const offsetX = (portalMundo.x - camera.x) * (canvasRect.width / canvas.width);
            const offsetY = (portalMundo.y - camera.y) * (canvasRect.height / canvas.height);

            brilhoPortalJapao.style.left = `${canvasRect.left + offsetX - 60}px`;
            brilhoPortalJapao.style.top = `${canvasRect.top + offsetY - 60}px`;

            requestAnimationFrame(atualizarPosicao);
        }

        atualizarPosicao();

        mostrarCenaComDialogoCor(
            'img/japao_intro.png',
            'Um portal surge diante de você...',
            'rgba(0, 60, 160, 0.8)',
            () => console.log('[PORTAL] Portal do Japão ativado com destaque luminoso.')
        );
    }

    // --- Animação CSS ---
    const estiloPortal = document.createElement('style');
    estiloPortal.innerHTML = `
@keyframes pulsarLuzPortal {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}`;
    document.head.appendChild(estiloPortal);

    function tocarSom(caminho, volume = 1, loop = false, fade = true) {
        if (!audioUnlocked) return null;

        const audio = new Audio(caminho);
        audio.loop = loop;
        const track = audioContext.createMediaElementSource(audio);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        track.connect(gain).connect(audioContext.destination);

        if (fade) {
            gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.25);
        } else {
            gain.gain.value = volume;
        }

        audio.play();

        if (fade) {
            audio.addEventListener("ended", () => {
                gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            });
        }

        return { audio, gain };
    }

    // --- CENAS E TRANSIÇÕES ---
    function transicaoParaLibrary(callback) {
        isDialogOpen = true;
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'black';
        overlay.style.opacity = '1';
        overlay.style.zIndex = '9999';
        overlay.style.transition = 'opacity 3s ease';
        document.body.appendChild(overlay);

        // 🔊 Som de porta único, sem loop
        tocarSom(SONS.porta, 0.7, false);

        if (typeof callback === 'function') callback();

        setTimeout(() => overlay.style.opacity = '0', 2000);

        setTimeout(() => {
            overlay.remove();
            mostrarDialogoInicialLibrary();
        }, 4000);
    }

    function mostrarDialogoInicialLibrary(onFinish = null) {
        const canvasRect = canvas.getBoundingClientRect();

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = `${canvasRect.left + canvasRect.width / 2}px`;
        container.style.top = `${canvasRect.top + canvasRect.height - 140}px`;
        container.style.transform = 'translateX(-50%)';
        container.style.width = `${canvasRect.width * 0.9}px`;
        container.style.padding = '25px';
        container.style.background = 'rgba(0, 60, 160, 0.8)';
        container.style.color = 'white';
        container.style.fontFamily = "'Press Start 2P', cursive";
        container.style.fontSize = '14px';
        container.style.textAlign = 'center';
        container.style.borderRadius = '12px 12px 0 0';
        container.style.boxShadow = '0 -2px 20px rgba(0,0,0,0.5)';
        container.style.zIndex = '9999';
        container.style.minHeight = '80px';
        container.style.transition = 'opacity 0.6s ease';
        container.style.opacity = '0';
        document.body.appendChild(container);

        requestAnimationFrame(() => container.style.opacity = '1');

        const texto = "Já fazia muito tempo que não vinha nesse lugar, está bem bagunçado... ";
        let i = 0;
        let digitarTimer = null;

        function digitarTexto() {
            if (i === 0) iniciarSomDigitacaoGlobal(); // inicia o som global

            if (i < texto.length) {
                container.innerText = texto.substring(0, i + 1);
                i++;
                digitarTimer = setTimeout(digitarTexto, 45);
            } else {
                pararSomDigitacaoGlobal();
                setTimeout(() => {
                    container.style.opacity = '0';
                    setTimeout(() => {
                        container.remove();
                        destacarLivroComLuz();
                        isDialogOpen = false;
                        if (typeof onFinish === "function") onFinish();
                    }, 600);
                }, 1500);
            }
        }

        digitarTexto();
    }

    let brilhoLivro = null;

    function destacarLivroComLuz() {
        // Evita duplicar o brilho se já existir
        if (brilhoLivro) return;

        brilhoLivro = document.createElement('div');
        brilhoLivro.style.position = 'absolute';
        brilhoLivro.style.width = '90px';
        brilhoLivro.style.height = '90px';
        brilhoLivro.style.borderRadius = '50%';
        brilhoLivro.style.background = 'radial-gradient(rgba(255, 255, 180, 0.85), rgba(255, 255, 0, 0))';
        brilhoLivro.style.pointerEvents = 'none';
        brilhoLivro.style.zIndex = '5000';
        brilhoLivro.style.animation = 'pulsarLuz 1.5s infinite ease-in-out';
        document.body.appendChild(brilhoLivro);

        const livroMundo = { x: 986, y: 261 }; // posição fixa do livro

        function atualizarPosicao() {
            if (!brilhoLivro) return;
            const canvasRect = canvas.getBoundingClientRect();
            const offsetX = (livroMundo.x - camera.x) * (canvasRect.width / canvas.width);
            const offsetY = (livroMundo.y - camera.y) * (canvasRect.height / canvas.height);
            brilhoLivro.style.left = `${canvasRect.left + offsetX - 45}px`;
            brilhoLivro.style.top = `${canvasRect.top + offsetY - 45}px`;
            requestAnimationFrame(atualizarPosicao);
        }

        atualizarPosicao();
    }

    // --- Animações CSS ---
    const estiloLuz = document.createElement('style');
    estiloLuz.innerHTML = `
@keyframes pulsarLuz {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}`;
    document.head.appendChild(estiloLuz);



    // --- Animações fade ---
    const style = document.createElement('style');
    style.innerHTML = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }`;
    document.head.appendChild(style);


    // ---  CONSTANTES QUE DEPENDEM DO CANVAS --
    const CAMERA_BOX_WIDTH = canvas.width * 0.5;
    const CAMERA_BOX_HEIGHT = canvas.height * 0.5;

    // --- "Banco de Dados" dos Níveis ---
    const levels = {
        'library': {
            mapSrc: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/biblioteca_map.png',
            mapWidth: 1280,
            mapHeight: 717,
            startPos: { x: 641, y: 256 },
            collisions: [
                { x: 0, y: 255, width: 590, height: 295 },// Esquerda
                { x: 0, y: 550, width: 1600, height: 170 },// Baixo
                { x: 1060, y: 255, width: 230, height: 295 },// Direita
                { x: 900, y: 255, width: 160, height: 80 },// Mesa S.D
                { x: 700, y: 255, width: 0, height: 25 },//
                { x: 590, y: 430, width: 470, height: 120 },// Mesa
                { x: 0, y: 0, width: 1600, height: 255 },// Cima
            ],
            // --- NOVO: Objetos Interativos ---
            interactables: [
                {
                    id: 'egypt_book', // Identificador único
                    x: 986,           // Posição X (AJUSTE ESTE VALOR)
                    y: 261,           // Posição Y (AJUSTE ESTE VALOR)
                    width: 35,        // Largura da caixa de interação (AJUSTE)
                    height: 27,       // Altura da caixa de interação (AJUSTE)
                    hasInteracted: false,
                    action: function () { // Função a ser executada na interação
                        const book = this;
                        if (!book || book.hasInteracted || isDialogOpen || isLoadingLevel) return;


                        book.hasInteracted = true;
                        isDialogOpen = true;
                        tocarSom(SONS.paginas, 0.7, false);
                        console.log("📖 Interagiu com o Livro do Egito");

                        mostrarCenaComDialogo(
                            'img/livrobt.png',
                            'Parece ser um livro de história... Algumas páginas estão em branco. Isso é estranho...',
                            () => {
                                // Segundo diálogo
                                mostrarCenaComDialogo(
                                    'img/livrobt.png',
                                    '*De repente o livro te puxa até ele*',
                                    () => {
                                        console.log('[LIVRO] Jogador terminou o diálogo — preparando transição para o Egito...');

                                        // 🔧 Correção: reset de estados + garantia de áudio
                                        setTimeout(() => {
                                            isDialogOpen = false;
                                            isLoadingLevel = false;
                                            initAudio();

                                            // 🔄 Garante que o loop do jogo está ativo antes de trocar o mapa
                                            if (!isGameLoopRunning) {
                                                console.log('[LIVRO] Reiniciando loop de jogo antes da transição.');
                                                isGameLoopRunning = true;
                                                requestAnimationFrame(gameLoop);
                                            }

                                            // 🔥 Transição segura
                                            try {
                                                console.log('[LIVRO] Iniciando transição cinematográfica...');
                                                transicaoParaEgitoComCena();
                                            } catch (err) {
                                                console.error('[ERRO] Falha na transição para o Egito:', err);
                                                // fallback: recarrega o mapa manualmente
                                                try {
                                                    if (typeof brilhoLivro !== 'undefined' && brilhoLivro) {
                                                        brilhoLivro.remove();
                                                        brilhoLivro = null;
                                                        console.log('[LIVRO] Efeito de destaque removido antes da transição.');
                                                    }
                                                    loadLevel('egypt');
                                                    currentLevelId = 'egypt';
                                                    isDialogOpen = false;
                                                    isLoadingLevel = false;
                                                    console.warn('[FALLBACK] Egito carregado manualmente.');
                                                } catch (innerErr) {
                                                    console.error('[FATAL] Falha total ao carregar o Egito:', innerErr);
                                                }
                                            }
                                        }, 400); // aguarda um pouco para evitar corrida entre diálogos
                                    }
                                );
                            }
                        );
                    }
                }

            ]
        },
        'egypt': {
            mapSrc: 'img/mapaegypt.png',
            mapWidth: 1600, mapHeight: 896,
            startPos: { x: 1155, y: 817 },
            collisions: [
                { x: 367, y: 124, width: 175, height: 230 },// Lago foguete
                { x: 730, y: 115, width: 160, height: 165 },// Piramide
                { x: 1200, y: 0, width: 400, height: 260 }, { x: 1370, y: 260, width: 240, height: 80 }, // Monte SD
                { x: 1425, y: 540, width: 70, height: 147 }, { x: 1400, y: 570, width: 240, height: 100 }, { x: 1370, y: 590, width: 70, height: 52 }, { x: 1356, y: 609, width: 70, height: 22 }, { x: 1391, y: 642, width: 70, height: 22 },//
                { x: 1508, y: 670, width: 210, height: 230 },// estatua antiga
                { x: 1238, y: 680, width: 45, height: 150 }, { x: 1220, y: 700, width: 80, height: 100 }, { x: 1196, y: 717, width: 130, height: 80 }, { x: 1160, y: 736, width: 180, height: 25 }, { x: 1173, y: 761, width: 170, height: 20 }, { x: 1185, y: 778, width: 151, height: 20 }, { x: 1491, y: 812, width: 70, height: 110 }, { x: 1473, y: 827, width: 50, height: 100 }, { x: 1463, y: 841, width: 50, height: 100 }, { x: 1446, y: 856, width: 50, height: 100 }, { x: 1430, y: 868, width: 50, height: 100 },// Montes ED
                { x: 594, y: 600, width: 155, height: 300 }, { x: 749, y: 732, width: 120, height: 500 }, { x: 869, y: 767, width: 20, height: 150 }, { x: 888, y: 816, width: 26, height: 150 }, { x: 914, y: 835, width: 26, height: 150 },// IM
                { x: 0, y: 682, width: 594, height: 230 }, { x: 0, y: 622, width: 281, height: 60 }, { x: 466, y: 644, width: 150, height: 38 }, { x: 490, y: 516, width: 50, height: 48 }, { x: 490, y: 564, width: 30, height: 16 }, { x: 0, y: 494, width: 50, height: 140 }, { x: 0, y: 340, width: 61, height: 65 }, { x: 50, y: 548, width: 65, height: 100 }, { x: 115, y: 569, width: 15, height: 65 }, { x: 130, y: 591, width: 39, height: 35 },
                { x: 0, y: 0, width: 182, height: 190 }, { x: 182, y: 0, width: 60, height: 117 }, { x: 0, y: 190, width: 134, height: 140 }, { x: 0, y: 330, width: 90, height: 40 }, { x: 398, y: 479, width: 70, height: 10 }, { x: 398, y: 418, width: 70, height: 5 },// SP
                { x: 1093, y: 0, width: 109, height: 120 }, { x: 1120, y: 120, width: 100, height: 200 }, { x: 1085, y: 270, width: 100, height: 70 }, { x: 1020, y: 310, width: 165, height: 60 }, { x: 986, y: 344, width: 150, height: 60 }, { x: 952, y: 380, width: 144, height: 60 }, { x: 910, y: 410, width: 140, height: 60 }, { x: 851, y: 438, width: 170, height: 60 }, { x: 851, y: 497, width: 140, height: 90 }, { x: 707, y: 457, width: 63, height: 143 }, { x: 687, y: 477, width: 20, height: 39 }, { x: 662, y: 515, width: 45, height: 86 }, { x: 617, y: 538, width: 45, height: 63 }, { x: 603, y: 566, width: 30, height: 106 }, { x: 398, y: 489, width: 92, height: 80 }, { x: 451, y: 569, width: 39, height: 20 },// Rio
                { x: 1187, y: 485, width: 22, height: 25 }, { x: 1077, y: 622, width: 10, height: 20 }, { x: 1043, y: 194, width: 77, height: 17 }, //Pedras
                { x: 986, y: 128, width: 134, height: 50 }, { x: 1125, y: 598, width: 18, height: 45 }, { x: 1313, y: 512, width: 22, height: 52 }, { x: 1235, y: 427, width: 1, height: 30 }, { x: 1290, y: 608, width: 1, height: 30 }, { x: 841, y: 642, width: 1, height: 30 }, { x: 900, y: 186, width: 10, height: 30 }, { x: 690, y: 259, width: 20, height: 30 }, { x: 295, y: 415, width: 1, height: 30 }, { x: 240, y: 445, width: 1, height: 30 }, { x: 100, y: 472, width: 1, height: 29 }, { x: 382, y: 82, width: 1, height: 30 },// Árvores
            ],
            interactables: [
                {
                    id: 'quest_spot_1',
                    x: 410, y: 424, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestEgito('quest_spot_1')
                },
                {
                    id: 'quest_spot_2',
                    x: 792, y: 53, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestEgito('quest_spot_2')
                },
                {
                    id: 'quest_spot_3',
                    x: 1455, y: 763, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestEgito('quest_spot_3')
                }
            ],


        },
        'japan': {
            mapSrc: 'img/mapajapan.png',
            mapWidth: 1600, mapHeight: 896,
            startPos: { x: 1500, y: 600 },
            collisions: [
                { x: 0, y: 0, width: 250, height: 900 }, { x: 248, y: 442, width: 30, height: 500 }, { x: 248, y: 280, width: 300, height: 120 }, { x: 249, y: 358, width: 30, height: 100 }, { x: 279, y: 399, width: 62, height: 50 }, { x: 421, y: 399, width: 35, height: 50 }, { x: 534, y: 450, width: 1, height: 1 }, { x: 279, y: 483, width: 34, height: 100 }, { x: 275, y: 598, width: 115, height: 310 }, { x: 390, y: 622, width: 10, height: 300 }, { x: 401, y: 650, width: 33, height: 220 }, { x: 434, y: 675, width: 63, height: 48 }, { x: 434, y: 723, width: 40, height: 30 }, { x: 434, y: 753, width: 10, height: 100 }, { x: 668, y: 468, width: 30, height: 30 }, // Esquerda (floresta, templo, sakuras)
                { x: 444, y: 797, width: 80, height: 200 }, { x: 588, y: 789, width: 1, height: 13 }, { x: 580, y: 462, width: 90, height: 90 }, { x: 627, y: 444, width: 80, height: 39 }, { x: 680, y: 780, width: 90, height: 60 }, { x: 813, y: 635, width: 12, height: 65 }, { x: 0, y: 0, width: 40, height: 40 },// Inferior meio (antes do rio)
                { x: 670, y: 0, width: 60, height: 270 }, { x: 509, y: 0, width: 161, height: 240 }, { x: 251, y: 0, width: 10, height: 180 }, { x: 251, y: 171, width: 15, height: 110 }, { x: 266, y: 203, width: 157, height: 75 }, { x: 262, y: 0, width: 200, height: 95 }, { x: 403, y: 95, width: 105, height: 55 }, { x: 692, y: 300, width: 50, height: 72 }, { x: 713, y: 382, width: 90, height: 34 }, { x: 741, y: 345, width: 40, height: 40 }, { x: 796, y: 280, width: 1, height: 27 }, { x: 730, y: 0, width: 400, height: 270 }, { x: 835, y: 338, width: 1, height: 10 }, { x: 810, y: 389, width: 45, height: 150 }, { x: 854, y: 424, width: 108, height: 120 }, { x: 949, y: 444, width: 45, height: 120 }, { x: 994, y: 457, width: 20, height: 100 }, { x: 841, y: 538, width: 110, height: 29 }, { x: 882, y: 565, width: 110, height: 10 }, { x: 872, y: 640, width: 320, height: 300 }, { x: 1191, y: 676, width: 42, height: 300 }, { x: 966, y: 481, width: 73, height: 119 }, { x: 713, y: 416, width: 90, height: 40 }, { x: 788, y: 453, width: 40, height: 20 }, { x: 559, y: 535, width: 21, height: 15 }, { x: 535, y: 549, width: 40, height: 11 }, { x: 508, y: 574, width: 1, height: 2 }, // Superior Meio e Rio ( árvores, chalé superior e rio)
                { x: 1229, y: 676, width: 200, height: 90 }, { x: 1302, y: 639, width: 160, height: 40 }, { x: 1425, y: 676, width: 54, height: 20 }, { x: 1425, y: 695, width: 27, height: 39 }, { x: 1449, y: 853, width: 160, height: 70 }, { x: 1509, y: 832, width: 90, height: 31 }, { x: 1312, y: 803, width: 50, height: 30 }, { x: 1268, y: 836, width: 20, height: 28 }, { x: 1233, y: 764, width: 23, height: 150 }, { x: 1345, y: 547, width: 68, height: 60 }, { x: 1558, y: 622, width: 40, height: 20 },// Inferior direito (estribeiras do mapa)
                { x: 1468, y: 428, width: 60, height: 50 }, { x: 1383, y: 0, width: 200, height: 365 }, { x: 1461, y: 0, width: 200, height: 400 }, { x: 1387, y: 420, width: 1, height: 12 }, { x: 1181, y: 347, width: 92, height: 127 }, { x: 1290, y: 479, width: 40, height: 26 }, { x: 1281, y: 378, width: 46, height: 55 }, { x: 1130, y: 0, width: 10, height: 249 }, { x: 1139, y: 0, width: 28, height: 230 }, { x: 1167, y: 0, width: 20, height: 194 }, { x: 1187, y: 0, width: 15, height: 180 }, { x: 1202, y: 0, width: 15, height: 170 }, { x: 1217, y: 0, width: 13, height: 160 }, { x: 1230, y: 0, width: 10, height: 150 }, { x: 1240, y: 0, width: 15, height: 110 }, { x: 1255, y: 0, width: 30, height: 80 }, { x: 1285, y: 0, width: 98, height: 40 }, { x: 1359, y: 0, width: 24, height: 350 }, { x: 1330, y: 110, width: 29, height: 221 }, { x: 1295, y: 152, width: 35, height: 152 }, { x: 1261, y: 200, width: 33, height: 90 }, { x: 1231, y: 245, width: 30, height: 40 }, { x: 1120, y: 430, width: 62, height: 170 }, { x: 1039, y: 380, width: 81, height: 220 }, { x: 0, y: 0, width: 40, height: 40 }, { x: 876, y: 315, width: 4, height: 4 }, { x: 959, y: 300, width: 43, height: 24 }// Superior direito (estribeiras do mapa/morros e contruções superiores)

            ],
            interactables: [
                {
                    id: 'jp_spot_1',
                    x: 368, y: 392, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestJapao('jp_spot_1')
                },
                {
                    id: 'jp_spot_2',
                    x: 1303, y: 48, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestJapao('jp_spot_2')
                },
                {
                    id: 'jp_spot_3',
                    x: 1355, y: 790, width: 30, height: 30,
                    active: true,
                    concluida: false,
                    errouUltima: false,
                    bloqueado: false,
                    action: () => iniciarQuestJapao('jp_spot_3')
                },

            ]
        },
    }

    function forceLoadLevel(levelId) {
        try {
            console.log('[FORCE LOAD] solicitando load do level:', levelId);

            // 1) libera flags que podem bloquear o loop (dialogos/transicoes)
            if (typeof isDialogOpen !== 'undefined') {
                isDialogOpen = false;
                console.log('[FORCE LOAD] isDialogOpen forcado para false');
            }
            if (typeof isLoadingLevel !== 'undefined') {
                isLoadingLevel = true; // sinaliza que estamos carregando para evitar reentrância
            }

            // 2) tenta usar a loadLevel original, se existir
            if (typeof loadLevel === 'function') {
                console.log('[FORCE LOAD] chamando loadLevel() original...');
                loadLevel(levelId);
            } else {
                // 3) fallback mínimo — troca a variável do nível e tenta inicializar o nível manualmente
                console.warn('[FORCE LOAD] loadLevel() não encontrada — usando fallback manual');
                currentLevelId = levelId;
                // Se existir uma função initLevel, chamar; senão tentar redesenhar o mapa
                if (typeof initLevel === 'function') {
                    initLevel(levelId);
                } else if (typeof drawCurrentLevel === 'function') {
                    drawCurrentLevel();
                } else {
                    // tentativa genérica: recarrega o asset do mapa e pede redraw
                    const lvl = levels[levelId];
                    if (lvl && lvl.mapSrc && typeof loadImage === 'function') {
                        // se tens função loadImage -> carrega e chama redraw
                        loadImage(lvl.mapSrc, (img) => {
                            // espera que haja rotina que use currentLevelId / mapa carregado
                            currentLevelId = levelId;
                            if (typeof onLevelImageReady === 'function') onLevelImageReady(img, levelId);
                        });
                    } else {
                        // último recurso: seta currentLevelId e força o loop de render
                        currentLevelId = levelId;
                    }
                }
            }

            console.log('[FORCE LOAD] load solicitado: ', levelId);
        } catch (err) {
            console.error('[FORCE LOAD] erro ao forçar loadLevel:', err);
        } finally {
            // libera flag de loading (com pequeno delay para permitir init do level)
            setTimeout(() => {
                if (typeof isLoadingLevel !== 'undefined') isLoadingLevel = false;
                console.log('[FORCE LOAD] isLoadingLevel = false (finalizado)');
            }, 150); // delay pequeno para evitar reentrância imediata
        }
    }
    function iniciarDebugJapao() {
        console.log('[DEBUG] Iniciando modo debug: JAPÃO');

        // Garante que nada bloqueia
        isDialogOpen = false;
        isLoadingLevel = false;
        questAtiva = false;

        // Garante que a tela de carregamento desapareça
        if (startScreen) startScreen.style.display = 'none';

        // Força o nível a ser carregado normalmente
        console.log('[DEBUG] Chamando loadLevel("japan")...');
        loadLevel('japan');

        // 🔁 Reinicia o loop se ele estiver parado
        if (!isGameLoopRunning) {
            console.log('[DEBUG] Reiniciando gameLoop...');
            isGameLoopRunning = true;
            requestAnimationFrame(gameLoop);
        }

        console.log('[DEBUG] Debug Japão concluído.');
    }


    // 🔹 Atalho rápido pelo teclado (pressione F2 para debug)
    window.addEventListener("keydown", (e) => {
        if (e.key === "F2") {
            e.preventDefault();
            iniciarDebugJapao();
        }
    });


    // --- Estado Global do Jogo ---
    let currentLevelId = 'library';
    let isGameLoopRunning = false;
    let isLoadingLevel = false;
    let isDialogOpen = false;

    // --- CARREGAMENTO DE ASSETS ---
    const assets = {
        maps: {},
        player: {
            runRight: new Image(), runLeft: new Image(), runUp: new Image(), runDown: new Image(),
            idleDown: new Image(), idleUp: new Image(), idleLeft: new Image(), idleRight: new Image()
        }
    };
    const playerAssetUrls = {
        runRight: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_right.png',
        runLeft: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_left.png',
        runUp: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_up.png',
        runDown: 'https://uploads.onecompiler.io/43rztqetx/43zh9k8ba/run_down.png',
        idleDown: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_down.png',
        idleUp: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_up.png',
        idleLeft: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_left.png',
        idleRight: 'https://uploads.onecompiler.io/43rzumf93/44293xhug/idle_right.png'
    };

    // ---  OBJETOS E ESTADO DO JOGO ---
    const camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    const player = {
        x: 0, y: 0, width: 0, height: 0, drawWidth: 0, drawHeight: 0,
        hitbox: { offsetX: 0, offsetY: 0, width: 0, height: 0 },
        speed: 3.5, state: 'idleDown', direction: 'down',
        currentFrame: 0, animationSpeed: 15, frameCount: 0,
        animations: {
            runRight: { totalFrames: 8 }, runLeft: { totalFrames: 8 }, runUp: { totalFrames: 8 },
            runDown: { totalFrames: 8 }, idleDown: { totalFrames: 8 }, idleUp: { totalFrames: 8 },
            idleLeft: { totalFrames: 8 }, idleRight: { totalFrames: 8 }
        },
        targetX: null, targetY: null
    };
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    const mouse = { worldX: 0, worldY: 0 };
    const joystick = { active: false, touchId: null, baseX: 0, baseY: 0, radius: 0, deadzone: 0 };

    // --- FUNÇÕES DE CONTROLO E INPUT ---
    function updateJoystickPosition() {
        const rect = joystickContainer.getBoundingClientRect();
        joystick.baseX = rect.left + rect.width / 2;
        joystick.baseY = rect.top + rect.height / 2;
        joystick.radius = rect.width / 2;
        joystick.deadzone = joystick.radius * 0.2;
    }

    function initJoystick() {
        const isMobile = 'ontouchstart' in window;
        if (!isMobile) {
            joystickContainer.style.display = 'none';
            actionButton.style.display = 'none';
            return;
        }
        joystickContainer.style.display = 'block';
        actionButton.style.display = 'flex';
        updateJoystickPosition();
        joystickContainer.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });
        actionButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            actionButton.classList.add('pressed');
            handleInteraction();
        }, { passive: false });
        actionButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            actionButton.classList.remove('pressed');
        }, { passive: false });
    }

    function onTouchStart(event) {
        event.preventDefault();
        if (joystick.active) return;
        const touch = event.changedTouches[0];
        joystick.active = true;
        joystick.touchId = touch.identifier;
        onTouchMove(event);
    }

    function onTouchMove(event) {
        if (!joystick.active) return;
        let touch;
        for (let i = 0; i < event.changedTouches.length; i++) {
            if (event.changedTouches[i].identifier === joystick.touchId) {
                touch = event.changedTouches[i];
                break;
            }
        }
        if (!touch) return;
        event.preventDefault();
        let dx = touch.clientX - joystick.baseX;
        let dy = touch.clientY - joystick.baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > joystick.radius) {
            dx = (dx / distance) * joystick.radius;
            dy = (dy / distance) * joystick.radius;
        }
        joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        if (distance < joystick.deadzone) return;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx > absDy) {
            if (dx > 0) keys.ArrowRight = true; else keys.ArrowLeft = true;
        } else {
            if (dy > 0) keys.ArrowDown = true; else keys.ArrowUp = true;
        }
    }

    function onTouchEnd(event) {
        if (!joystick.active) return;
        let isOurTouch = false;
        for (let i = 0; i < event.changedTouches.length; i++) {
            if (event.changedTouches[i].identifier === joystick.touchId) {
                isOurTouch = true;
                break;
            }
        }
        if (!isOurTouch) return;
        joystick.active = false;
        joystick.touchId = null;
        joystickStick.style.transform = 'translate(0px, 0px)';
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    }

    function initClickToMove() {
        canvas.addEventListener('click', handleWorldPointer);
        canvas.addEventListener('touchstart', handleWorldPointer, { passive: false });
    }

    function handleWorldPointer(event) {
        let targetId = event.target ? event.target.id : '';
        if (targetId === 'joystick-container' || targetId === 'joystick-stick' || targetId === 'action-button') return;
        event.preventDefault();
        let clientX, clientY;
        if (event.type === 'touchstart') {
            if (event.touches.length > 1) return;
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const screenX = (clientX - rect.left) * scaleX;
        const screenY = (clientY - rect.top) * scaleY;
        const worldX = screenX + camera.x;
        const worldY = screenY + camera.y;
        findNearestHotspot(worldX, worldY);
    }

    function findNearestHotspot(worldX, worldY) {
        const levelData = levels[currentLevelId];
        if (!levelData.hotspots || isLoadingLevel) return;
        let nearestHotspot = null;
        let minDistance = Infinity;
        const clickRadius = 150;
        for (const hotspot of levelData.hotspots) {
            const dx = hotspot.x - worldX;
            const dy = hotspot.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance && distance < clickRadius) {
                minDistance = distance;
                nearestHotspot = hotspot;
            }
        }
        if (nearestHotspot) {
            player.targetX = nearestHotspot.x;
            player.targetY = nearestHotspot.y;
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        }
    }

    function initDebugTools() {
        if (!DEBUG_MODE) return;
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            mouse.worldX = Math.floor((event.clientX - rect.left) * scaleX + camera.x);
            mouse.worldY = Math.floor((event.clientY - rect.top) * scaleY + camera.y);
        });
    }

    // --- "Ouvintes" de Teclado ---
    window.addEventListener('keydown', (event) => {
        if (event.repeat) return;

        // ⛔ Se o foco estiver em um campo de texto (input), não bloqueia o E
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            return;
        }

        // Se o diálogo estiver aberto, não deixa o jogo processar o "E"
        if (isDialogOpen) {
            return; // 🔒 Bloqueia o handleInteraction e movimento
        }

        const canvasStyle = window.getComputedStyle(canvas);
        if (canvasStyle.display === 'none') {
            if (event.key === 'Enter') {
                event.preventDefault();
                startGame();
            }
            return;
        }

        // Movimento
        if (event.key in keys) {
            event.preventDefault();
            keys[event.key] = true;
        }

        // Interação (E ou Enter)
        if (event.key === 'Enter' || event.key.toLowerCase() === 'e') {
            event.preventDefault();
            handleInteraction(event);
        }
    });



    window.addEventListener('keyup', (event) => {
        if (event.key in keys) {
            event.preventDefault();
            keys[event.key] = false;
        }
    });

    window.addEventListener('blur', () => {
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    });

    // --- FUNÇÕES PRINCIPAIS DO JOGO ---
    function checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // --- NOVO: Calcula a caixa de interação à frente do jogador ---
    function calculatePlayerInteractionBox() {

        const interactionDist = 5; // Distância base à frente da hitbox
        const overlapAmount = 30;   // Sobreposição na hitbox
        let interactionWidth = 30; // Largura padrão
        let interactionHeight = 30;// Altura padrão

        const hitboxX = player.x + player.hitbox.offsetX;
        const hitboxY = player.y + player.hitbox.offsetY;
        const hitboxW = player.hitbox.width;
        const hitboxH = player.hitbox.height;

        let ix = 0;
        let iy = 0;

        switch (player.direction) {
            case 'up':
                // --- MODIFICADO ---
                interactionWidth = 30;  // Caixa mais estreita
                interactionHeight = 70; // Caixa mais alta
                // Posiciona acima, sobrepõe, e centraliza horizontalmente
                iy = hitboxY - interactionDist - interactionHeight;
                ix = hitboxX + (hitboxW / 2) - (interactionWidth / 2);
                // ---------------
                break;
            case 'down':
                // --- MODIFICADO ---
                interactionWidth = 30;  // Caixa mais estreita
                interactionHeight = 50; // Caixa mais alta
                // Posiciona abaixo, sobrepõe, e centraliza horizontalmente
                iy = hitboxY + hitboxH + interactionDist - overlapAmount;
                ix = hitboxX + (hitboxW / 2) - (interactionWidth / 2);
                // ---------------
                break;
            case 'left':
                interactionWidth = 50;  // Caixa mais larga
                interactionHeight = 50; // Caixa mais alta
                ix = hitboxX - interactionDist - interactionWidth + overlapAmount;
                // Centraliza verticalmente, puxando um pouco para cima
                iy = hitboxY + (hitboxH / 2) - (interactionHeight / 2) - 10;
                break;
            case 'right':
                interactionWidth = 50;  // Caixa mais larga
                interactionHeight = 50; // Caixa mais alta
                ix = hitboxX + hitboxW + interactionDist - overlapAmount;
                // Centraliza verticalmente, puxando um pouco para cima
                iy = hitboxY + (hitboxH / 2) - (interactionHeight / 2) - 10;
                break;
        }

        return {
            x: Math.floor(ix),
            y: Math.floor(iy),
            width: interactionWidth,
            height: interactionHeight
        };
    }

    function handleInteraction(e) {
        console.log('[HANDLE] tecla pressionada:', e.key, 'isDialogOpen:', isDialogOpen);

        if (isLoadingLevel) return;
        const levelData = levels[currentLevelId];
        if (!levelData.interactables) return;

        const box = calculatePlayerInteractionBox();

        for (const item of levelData.interactables) {
            const rect = { x: item.x, y: item.y, width: item.width, height: item.height };

            if (checkCollision(box, rect)) {
                // Bloqueia interações indesejadas
                if (isDialogOpen) {
                    console.log('[HANDLE] Ignorado — diálogo ainda ativo');
                    return;
                }

                if (item.concluida) {
                    console.log(`[HANDLE] Ignorado — ${item.id} já foi concluído`);
                    return;
                }

                if (item.bloqueado) {
                    console.log(`[HANDLE] Ignorado — ${item.id} está temporariamente bloqueado`);
                    return;
                }

                // Executa ação se estiver tudo OK
                if (typeof item.action === 'function') {
                    console.log(`[HANDLE] Executando ação de ${item.id}`);
                    ultimoLocalInteragido = item.id;
                    item.action();
                }

                return;
            }
        }
    }

    function resizeCanvas() {
        console.log("--- resizeCanvas INICIADO ---"); // LOG Início

        const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        console.log(`Window Dimensions: ${windowWidth}w x ${windowHeight}h`); // LOG Janela

        const windowRatio = windowWidth / windowHeight;

        let newWidth;
        let newHeight;

        if (windowRatio > aspectRatio) {
            newHeight = windowHeight;
            newWidth = newHeight * aspectRatio;
            console.log(`Modo Landscape/Wide: Limitado pela Altura.`); // LOG Modo
        } else {
            newWidth = windowWidth;
            newHeight = newWidth / aspectRatio;
            console.log(`Modo Portrait/Tall: Limitado pela Largura.`); // LOG Modo
        }

        // Arredonda para evitar pixels quebrados
        newWidth = Math.floor(newWidth);
        newHeight = Math.floor(newHeight);

        console.log(`Calculated Canvas Style: ${newWidth}px w x ${newHeight}px h`); // LOG Calculado

        // Aplica o novo tamanho ao estilo do canvas
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;

        console.log(`Applied Style - Width: ${canvas.style.width}, Height: ${canvas.style.height}`); // LOG Aplicado

        // Pega as dimensões *reais* do elemento após aplicar o estilo
        // (setTimeout pequeno para dar tempo ao navegador de renderizar)
        setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            console.log(`Actual Element Rect (after style): ${rect.width.toFixed(2)}w x ${rect.height.toFixed(2)}h`); // LOG Real
        }, 10); // Aumentei ligeiramente o tempo para garantir a leitura

        if ('ontouchstart' in window) {
            updateJoystickPosition();
        }
        console.log(`--- resizeCanvas FINALIZADO --- Canvas Attrs: ${canvas.width}x${canvas.height}`); // LOG Fim
    }

    function update() {
        if (isDialogOpen || isLoadingLevel) return;
        const levelData = levels[currentLevelId];
        const oldX = player.x;
        const oldY = player.y;
        let dx = 0, dy = 0;
        let wantsToMove = false;

        if (keys.ArrowUp) { dy -= player.speed; }
        if (keys.ArrowDown) { dy += player.speed; }
        if (keys.ArrowLeft) { dx -= player.speed; }
        if (keys.ArrowRight) { dx += player.speed; }

        if (dx === 0 && dy === 0 && player.targetX !== null && player.targetY !== null) {
            const targetX_centered = player.targetX - (player.drawWidth / 2);
            const targetY_centered = player.targetY - (player.drawHeight / 2);
            const vecX = targetX_centered - player.x;
            const vecY = targetY_centered - player.y;
            const distance = Math.sqrt(vecX * vecX + vecY * vecY);
            if (distance < player.speed) {
                player.x = targetX_centered;
                player.y = targetY_centered;
                player.targetX = player.targetY = null;
                wantsToMove = false;
            } else {
                dx = (vecX / distance) * player.speed;
                dy = (vecY / distance) * player.speed;
                wantsToMove = true;
            }
        } else if (dx !== 0 || dy !== 0) {
            wantsToMove = true;
            player.targetX = player.targetY = null;
        }

        // --- SOM DE PASSOS: start/stop controlado ---
        if (wantsToMove && !isDialogOpen) {
            if (!player.stepSound) {
                player.stepSound = tocarSom(SONS.passos, 0.5, true);
            }
        } else {
            if (player.stepSound && player.stepSound.audio) {
                player.stepSound.audio.pause();
                player.stepSound.audio.currentTime = 0;
                player.stepSound = null;
            }
        }

        if (wantsToMove) {
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) { player.state = 'runRight'; player.direction = 'right'; }
                else { player.state = 'runLeft'; player.direction = 'left'; }
            } else { // movimento vertical dominante
                if (dy > 0) { player.state = 'runDown'; player.direction = 'down'; }
                else { player.state = 'runUp'; player.direction = 'up'; }
            }
        } else {
            // idle de acordo com a última direção
            if (player.direction === 'up') player.state = 'idleUp';
            else if (player.direction === 'left') player.state = 'idleLeft';
            else if (player.direction === 'right') player.state = 'idleRight';
            else player.state = 'idleDown';
        }

        // --- Aplica movimento com checagem de colisões ---
        if (dx !== 0) {
            player.x += dx;
            const playerHitbox = { x: player.x + player.hitbox.offsetX, y: oldY + player.hitbox.offsetY, width: player.hitbox.width, height: player.hitbox.height };
            if (levelData.collisions) {
                for (const collisionBox of levelData.collisions) {
                    if (checkCollision(playerHitbox, collisionBox)) {
                        player.x = oldX;
                        break;
                    }
                }
            }
        }
        if (dy !== 0) {
            player.y += dy;
            const playerHitbox = { x: player.x + player.hitbox.offsetX, y: player.y + player.hitbox.offsetY, width: player.hitbox.width, height: player.hitbox.height };
            if (levelData.collisions) {
                for (const collisionBox of levelData.collisions) {
                    if (checkCollision(playerHitbox, collisionBox)) {
                        player.y = oldY;
                        break;
                    }
                }
            }
        }

        // --- Animação frames ---
        player.frameCount++;
        if (player.frameCount >= player.animationSpeed) {
            player.frameCount = 0;
            player.currentFrame = (player.currentFrame + 1) % player.animations[player.state].totalFrames;
        }

        // --- Limites do mapa ---
        player.x = Math.max(0, Math.min(player.x, levelData.mapWidth - player.drawWidth));
        player.y = Math.max(0, Math.min(player.y, levelData.mapHeight - player.drawHeight));

        // --- Atualiza câmera mantendo o jogador dentro da camera box ---
        const boxLeft = camera.x + (camera.width - CAMERA_BOX_WIDTH) / 2;
        const boxRight = boxLeft + CAMERA_BOX_WIDTH;
        const boxTop = camera.y + (camera.height - CAMERA_BOX_HEIGHT) / 2;
        const boxBottom = boxTop + CAMERA_BOX_HEIGHT;
        if (player.x < boxLeft) camera.x = player.x - (camera.width - CAMERA_BOX_WIDTH) / 2;
        else if (player.x + player.drawWidth > boxRight) camera.x = player.x + player.drawWidth - CAMERA_BOX_WIDTH - (camera.width - CAMERA_BOX_WIDTH) / 2;
        if (player.y < boxTop) camera.y = player.y - (camera.height - CAMERA_BOX_HEIGHT) / 2;
        else if (player.y + player.drawHeight > boxBottom) camera.y = player.y + player.drawHeight - CAMERA_BOX_HEIGHT - (camera.height - CAMERA_BOX_HEIGHT) / 2;
        camera.x = Math.max(0, Math.min(camera.x, levelData.mapWidth - camera.width));
        camera.y = Math.max(0, Math.min(camera.y, levelData.mapHeight - camera.height));

        let indicadorCriado = false;
        let indicador = null;

        function mostrarIndicadorInteracao() {
            const levelData = levels[currentLevelId];
            if (!levelData || !levelData.interactables) return;

            const box = calculatePlayerInteractionBox();
            let perto = false;

            for (const item of levelData.interactables) {
                if (item.active && checkCollision(box, item)) {
                    perto = true;
                    break;
                }
            }

            // cria o indicador apenas uma vez
            if (!indicadorCriado) {
                indicador = document.createElement('div');
                indicador.id = 'indicadorE';
                indicador.innerText = 'E';
                Object.assign(indicador.style, {
                    position: 'absolute',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(0, 60, 160, 0.85)',
                    color: 'white',
                    fontFamily: "'Press Start 2P', cursive",
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '16px',
                    zIndex: '9999',
                    animation: 'pulsar 1s infinite',
                    transition: 'opacity 0.3s ease',
                    opacity: '0'
                });
                document.body.appendChild(indicador);

                const style = document.createElement('style');
                style.innerHTML = `
            @keyframes pulsar {
                0% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 0.9; }
            }`;
                document.head.appendChild(style);

                indicadorCriado = true;
            }

            if (indicador) {
                indicador.style.opacity = perto ? '1' : '0';
                if (perto) {
                    indicador.style.left = `${player.x + 32}px`;
                    indicador.style.top = `${player.y - 40}px`;
                }
            }
        }
        if (currentLevelId === 'egypt') {
            const nivel = levels['egypt'];
            const playerBox = calculatePlayerInteractionBox();

            for (const i of nivel.interactables) {
                if (i.isPortal && i.active && checkCollision(playerBox, i)) {
                    iniciarTransicaoJapao();
                    break;
                }
            }
        }
        // --- Verifica se o jogador entrou no portal do Japão para a biblioteca ---
        if (currentLevelId === 'japan') {
            const levelData = levels['japan'];
            const playerBox = calculatePlayerInteractionBox();

            for (const hotspot of levelData.hotspots || []) {
                if (hotspot.isPortal && checkCollision(playerBox, { x: hotspot.x - 40, y: hotspot.y - 40, width: 80, height: 80 })) {
                    iniciarTransicaoBiblioteca();
                    break;
                }
            }
        }

    }

    function draw() {
        if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
            console.error(`ERRO: Resolução interna do Canvas alterada! É ${canvas.width}x${canvas.height}, deveria ser ${GAME_WIDTH}x${GAME_HEIGHT}`);
            // Opcional: Tentar corrigir (pode causar 'flicker')
            // canvas.width = GAME_WIDTH;
            // canvas.height = GAME_HEIGHT;
        }

        if (isLoadingLevel) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        const levelData = levels[currentLevelId];
        const currentMapImage = assets.maps[currentLevelId];

        if (currentMapImage && currentMapImage.complete) {
            ctx.drawImage(currentMapImage, 0, 0, levelData.mapWidth, levelData.mapHeight);
        }

        if (levelData.hotspots) {
            ctx.save();
            for (const hotspot of levelData.hotspots) {
                const pulse = Math.abs(Math.sin(Date.now() / 300));
                const radius = 15 + pulse * 5;
                ctx.beginPath();
                ctx.arc(hotspot.x, hotspot.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 220, 0, 0.4)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(hotspot.name, hotspot.x, hotspot.y - (radius + 10));
            }
            ctx.restore();
        }

        let currentSpriteSheet;
        switch (player.state) {
            case 'runUp': currentSpriteSheet = assets.player.runUp; break;
            case 'runLeft': currentSpriteSheet = assets.player.runLeft; break;
            case 'runRight': currentSpriteSheet = assets.player.runRight; break;
            case 'runDown': currentSpriteSheet = assets.player.runDown; break;
            case 'idleUp': currentSpriteSheet = assets.player.idleUp; break;
            case 'idleLeft': currentSpriteSheet = assets.player.idleLeft; break;
            case 'idleRight': currentSpriteSheet = assets.player.idleRight; break;
            case 'idleDown': default: currentSpriteSheet = assets.player.idleDown; break;
        }
        if (currentSpriteSheet && currentSpriteSheet.complete && player.width > 0) {
            const sx = player.currentFrame * player.width;
            const sy = 0;
            ctx.drawImage(currentSpriteSheet, sx, sy, player.width, player.height, player.x, player.y, player.drawWidth, player.drawHeight);
        }
        if (levels[currentLevelId]?.interactables) {
            const box = calculatePlayerInteractionBox();
            let perto = false;
            for (const item of levels[currentLevelId].interactables) {
                if (checkCollision(box, item) && !item.concluida) {
                    perto = true;
                    break;
                }
            }

            if (perto) {
                ctx.save();
                ctx.font = "14px 'Press Start 2P', cursive";
                ctx.textAlign = "center";

                // Calcula posição centralizada acima do jogador
                const eX = player.x + player.width / 2;
                const eY = player.y - 15;

                // Fundo dourado arqueológico
                const grad = ctx.createRadialGradient(eX, eY, 2, eX, eY, 14);
                grad.addColorStop(0, "#FFD700");
                grad.addColorStop(1, "#B8860B");

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(eX, eY, 12, 0, Math.PI * 2);
                ctx.fill();

                // Borda envelhecida
                ctx.strokeStyle = "#3A2E0A";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Letra “E” branca
                ctx.fillStyle = "white";
                ctx.fillText("E", eX, eY + 5);
                ctx.restore();
            }
        }

        if (DEBUG_MODE) {
            if (levelData.collisions) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                for (const collisionBox of levelData.collisions) {
                    ctx.fillRect(collisionBox.x, collisionBox.y, collisionBox.width, collisionBox.height);
                }
            }
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.strokeRect(player.x + player.hitbox.offsetX, player.y + player.hitbox.offsetY, player.hitbox.width, player.hitbox.height);


            // --- NOVO: Desenha as caixas interativas do nível ---
            if (levelData.interactables) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'; // Verde semi-transparente
                for (const item of levelData.interactables) {
                    ctx.fillRect(item.x, item.y, item.width, item.height);
                }
            }

            // --- NOVO: Desenha a caixa de interação do jogador ---
            const playerInteractionBox = calculatePlayerInteractionBox();
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.strokeRect(playerInteractionBox.x, playerInteractionBox.y, playerInteractionBox.width, playerInteractionBox.height);

        }

        ctx.restore();

        if (DEBUG_MODE) {
            // --- Cálculo de Escala e Tamanho da Fonte ---
            const currentCanvasStyleHeight = parseFloat(canvas.style.height) || canvas.height;
            const currentScale = currentCanvasStyleHeight / GAME_HEIGHT;
            const baseFontSize = 18; // Tamanho base
            const minFontSize = 12; // <-- NOVO: Tamanho mínimo definido aqui

            // Calcula o tamanho da fonte escalada (usando o minFontSize)
            const scaledFontSize = Math.max(minFontSize, Math.floor(baseFontSize * currentScale));

            // Define a fonte com o tamanho escalado
            ctx.font = `bold ${scaledFontSize}px Arial`;
            // --------------------------------------------------

            ctx.fillStyle = 'lime';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            const coordsText = `X: ${mouse.worldX}, Y: ${mouse.worldY}`;

            // --- Ajusta o fundo e a posição do texto ---
            const textWidth = ctx.measureText(coordsText).width;
            // Usa Math.max também para o padding, para não ficar menor que a fonte mínima
            const padding = Math.max(3, 5 * currentScale);
            const rectHeight = scaledFontSize + padding * 2;
            const rectWidth = textWidth + padding * 2;
            const rectX = 10;
            const rectY = 10;

            // Desenha o fundo
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

            // Desenha o texto (ajustado verticalmente dentro do fundo)
            ctx.fillStyle = 'lime';
            // Ajusta a posição Y do texto para alinhar melhor com a linha de base dentro do retângulo
            ctx.textBaseline = 'middle'; // Alinha verticalmente pelo meio
            ctx.fillText(coordsText, rectX + padding, rectY + rectHeight / 2); // Centraliza Y no retângulo
        }
    }

    function gameLoop() {
        if (!isGameLoopRunning) return;
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
    let questPerguntasUsadasEgito = [];
    let questPerguntasUsadasJapao = [];

    function loadLevel(levelId) {
        if (isLoadingLevel) return;
        if (levels[levelId]?.interactables) {
            levels[levelId].interactables.forEach(i => {
                i.errouUltima = false;
                i.bloqueado = false;
                if (!i.concluida) i.active = true;
            });
        }
        isLoadingLevel = true;
        startScreen.style.display = 'flex';
        startScreen.innerText = 'Carregando...';
        const levelData = levels[levelId];
        const onMapReady = () => {
            if (levelId === 'egypt') questPerguntasUsadas = [];
            if (levelId === 'japan') questPerguntasUsadasJapao = [];

            currentLevelId = levelId;
            if (currentLevelId === 'library') {
                player.drawWidth = player.width * LIBRARY_PLAYER_SCALE;
                player.drawHeight = player.height * LIBRARY_PLAYER_SCALE;
            } else {
                player.drawWidth = player.width;
                player.drawHeight = player.height;
            }
            player.hitbox.width = player.drawWidth * 0.5;
            player.hitbox.height = player.drawHeight * 0.3;
            player.hitbox.offsetX = (player.drawWidth - player.hitbox.width) / 2;
            player.hitbox.offsetY = player.drawHeight * 0.7;
            player.x = levelData.startPos.x - (player.drawWidth / 2);
            player.y = levelData.startPos.y - (player.drawHeight / 2);
            player.targetX = player.targetY = null;
            camera.x = player.x - (camera.width / 2) + (player.drawWidth / 2);
            camera.y = player.y - (camera.height / 2) + (player.drawHeight / 2);
            camera.x = Math.max(0, Math.min(camera.x, levelData.mapWidth - camera.width));
            camera.y = Math.max(0, Math.min(camera.y, levelData.mapHeight - camera.height));
            startScreen.style.display = 'none';
            isLoadingLevel = false;
            draw();
            if (!isGameLoopRunning) {
                isGameLoopRunning = true;
                gameLoop();
            }
        };
        if (assets.maps[levelId] && assets.maps[levelId].complete) {
            onMapReady();
        } else {
            assets.maps[levelId] = new Image();
            assets.maps[levelId].onload = onMapReady;
            assets.maps[levelId].onerror = () => console.error(`Erro ao carregar o mapa: ${levelData.mapSrc}`);
            assets.maps[levelId].src = levelData.mapSrc;
        }
    }

    function startGame() {
        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        resizeCanvas();
        startScreen.style.display = 'flex';
        startScreen.innerText = 'Carregando Jogo...';
        let playerAssetsLoaded = 0;
        const totalPlayerAssets = Object.keys(playerAssetUrls).length;

        const onPlayerAssetLoad = () => {
            playerAssetsLoaded++;
            if (playerAssetsLoaded === totalPlayerAssets) {
                runFinalSetupAndLoadFirstLevel();
            }
        };
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            setTimeout(() => alternarFullscreen(), 2000);
        }

        const runFinalSetupAndLoadFirstLevel = () => {
            const frameData = assets.player.idleDown;
            if (frameData.complete && frameData.naturalWidth > 0) {
                player.width = frameData.naturalWidth / player.animations.idleDown.totalFrames;
                player.height = frameData.naturalHeight;
            } else {
                player.width = 64; player.height = 64;
            }
            player.drawWidth = player.width;
            player.drawHeight = player.height;
            transicaoParaLibrary(() => loadLevel('library'));

        };

        let allReady = true;
        for (const key in assets.player) {
            const img = assets.player[key];
            if (!img.complete || img.naturalWidth === 0) {
                allReady = false;
                break;
            }
        }

        if (allReady) {
            runFinalSetupAndLoadFirstLevel();
        } else {
            const onError = (assetName, e) => console.error(`ERRO AO CARREGAR ASSET: ${assetName}`, e);
            for (const key in playerAssetUrls) {
                assets.player[key].onload = onPlayerAssetLoad;
                assets.player[key].onerror = (e) => onError(key, e);
                assets.player[key].src = playerAssetUrls[key];
            }
        }
    }

    window.addEventListener('resize', resizeCanvas);

    // --- PONTO DE ENTRADA ---
    resizeCanvas();
    initJoystick();
    initClickToMove();
    initDebugTools();

    // Preenchimento das funções de input para garantir que existem
    // (O seu ficheiro já deve ter estas definições completas, isto é uma salvaguarda)
    if (typeof onTouchStart !== 'function') {
        window.onTouchStart = function (event) {
            event.preventDefault();
            if (joystick.active) return;
            const touch = event.changedTouches[0];
            joystick.active = true;
            joystick.touchId = touch.identifier;
            onTouchMove(event);
        };

        window.onTouchMove = function (event) {
            if (!joystick.active) return;
            let touch;
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (event.changedTouches[i].identifier === joystick.touchId) {
                    touch = event.changedTouches[i];
                    break;
                }
            }
            if (!touch) return;
            event.preventDefault();
            let dx = touch.clientX - joystick.baseX;
            let dy = touch.clientY - joystick.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > joystick.radius) {
                dx = (dx / distance) * joystick.radius;
                dy = (dy / distance) * joystick.radius;
            }
            joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
            if (distance < joystick.deadzone) return;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx > absDy) {
                if (dx > 0) keys.ArrowRight = true;
                else keys.ArrowLeft = true;
            } else {
                if (dy > 0) keys.ArrowDown = true;
                else keys.ArrowUp = true;
            }
        };

        window.onTouchEnd = function (event) {
            if (!joystick.active) return;
            let isOurTouch = false;
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (event.changedTouches[i].identifier === joystick.touchId) {
                    isOurTouch = true;
                    break;
                }
            }
            if (!isOurTouch) return;
            joystick.active = false;
            joystick.touchId = null;
            joystickStick.style.transform = 'translate(0px, 0px)';
            keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        };
    }
    function criarBotaoFullscreen() {
        // Evita duplicação
        if (document.getElementById('fullscreen-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'fullscreen-btn';
        btn.innerHTML = '⛶';
        Object.assign(btn.style, {
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            width: '48px',
            height: '48px',
            fontSize: '22px',
            color: 'white',
            background: 'rgba(0,0,0,0.6)',
            border: '2px solid white',
            borderRadius: '10px',
            cursor: 'pointer',
            zIndex: 9999,
            display: 'none',
            transition: 'transform 0.2s ease'
        });

        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1.0)';

        btn.onclick = alternarFullscreen;

        document.body.appendChild(btn);

        // Só aparece em dispositivos móveis
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            btn.style.display = 'block';
        }
    }

    // Alterna o modo tela cheia
    function alternarFullscreen() {
        const doc = document;
        const elem = document.documentElement;

        if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
            console.log('[FULLSCREEN] Entrou em modo tela cheia');
        } else {
            if (doc.exitFullscreen) {
                doc.exitFullscreen();
            } else if (doc.webkitExitFullscreen) {
                doc.webkitExitFullscreen();
            } else if (doc.msExitFullscreen) {
                doc.msExitFullscreen();
            }
            console.log('[FULLSCREEN] Saiu do modo tela cheia');
        }
    }

    // Inicia automaticamente no carregamento
    window.addEventListener('load', criarBotaoFullscreen);

    // desbloqueia com interação do usuário
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
});

