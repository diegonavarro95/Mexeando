import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      welcome: 'Bienvenido',
      common: { cancel: 'Cancelar', go_home: 'Volver al inicio', try_again: 'Intentar de nuevo', yes: 'Sí', no: 'No', saving: 'Guardando...' },
      nav: { home: 'Inicio', map: 'Mapa', chat: 'Chat', album: 'Pasaporte', profile: 'Perfil' },
      explore: { greeting: 'Hola', search_placeholder: 'Buscar sabor local...', filters: { all: 'Todo', food: 'Comida', crafts: 'Artesanías', tours: 'Tours', art: 'Arte', wellness: 'Bienestar', commerce: 'Comercio' }, near_you: 'Cerca de ti', no_results: 'Sin resultados' },
      auth: {
        register: {
          title: 'Crear Cuenta', subtitle_tourist: 'Registro de Turista', subtitle_owner: 'Paso 1 de 3 - Datos Personales', manual_separator: 'o manualmente', display_name_label: '¿Cómo te llamamos?', display_name_placeholder: 'Ej. JuanViajero26', email_label: 'Tu mejor correo', email_placeholder: 'juan@email.com', password_label: 'Contraseña', password_placeholder: 'Mínimo 8 caracteres', security_label: 'Seguridad:', role_label: '¿Qué buscas en la ruta?', tourist_title: 'Turista', tourist_desc: 'Quiero explorar', owner_title: 'Dueño', owner_desc: 'Tengo un negocio', language_label: 'Idioma de la App', terms_prefix: 'Acepto los', terms_link: 'Términos y Condiciones', terms_suffix: 'y el aviso de privacidad de OLA MX.', submit_loading: 'Creando cuenta...', submit: 'Finalizar Registro', already_have: '¿Ya tienes cuenta?', sign_in: 'Inicia sesión',
          strength: { weak: '¡Poco seguro!', medium: 'Regular', strong: '¡Imbatible!' },
        },
        step2: {
          subtitle: 'Último paso', title: 'Datos del Local', step_count: 'Paso 3 / 3', location: 'Ubicación exacta', location_placeholder: 'Busca la dirección de tu local...', loading_maps: 'Cargando Google Maps...', city_detected: '✓ Ciudad detectada:', cities: { cdmx: 'Ciudad de México', gdl: 'Guadalajara', mty: 'Monterrey' }, phone: 'Teléfono', optional: '(opcional)', accepts_card: 'Acepta tarjeta', photos: 'Fotos del local', cover: 'portada', upload: 'Subir', photo_hint: 'La primera foto será la portada de tu negocio.', uploading: 'Subiendo fotos...', saving: 'Guardando negocio...', finalize: 'Finalizar Registro', review_notice: 'Tu negocio quedará en revisión hasta que un administrador lo apruebe.\nTe notificaremos cuando esté activo en el mapa.', error_geocoding: 'No pudimos obtener las coordenadas. Intenta con otra dirección.', error_max_photos: 'Máximo 5 fotos.', error_address: 'Selecciona una dirección válida del autocompletado.', error_card: 'Indica si tu negocio acepta tarjeta.', error_photo: 'Sube al menos una foto de tu local.', error_upload: 'Error subiendo imagen', error_generic: 'Ocurrió un error al guardar el negocio.',
        },
      },
      chat: {
        global: {
          title: 'Asistente Ola MX', online: 'En línea', starting: 'Iniciando...', welcome: '¡Hola! Soy Ola, tu asistente del Mundial. Pregúntame sobre restaurantes, tu pasaporte de estampas o qué hacer en la ciudad.', error: 'Ocurrió un error al contactar al asistente. Intenta de nuevo.', input_ready: 'Pregúntame algo del Mundial...', input_loading: 'Iniciando...',
          quick_replies: { best_places: '¿Cuáles son los mejores locales?', today_plan: '¿Qué me recomiendas hacer hoy?', passport: '¿Cómo funciona el pasaporte?', visit_places: '¿Qué lugares me recomiendas visitar?' },
        },
      },
      checkin: { header: 'Validador de Visita', greeting: '¡Hola, Garnachero!', instructions: 'Escanea el código del local para ganar estampas y puntos.', btn_start: 'Comenzar Escaneo', scanning_hud: 'BUSCANDO CÓDIGO...', syncing: 'Sincronizando con la red...', welcome_back: '¡De vuelta en casa!', golden_checkin: '¡Check-in Dorado!', points_earned: 'Puntos ganados', new_stamp: 'Nueva Estampa', total_balance: 'Total acumulado:', btn_another: 'Otro escaneo', btn_view_business: 'Ver Local', error_title: 'Hubo un problema', permission_error: 'Necesitamos acceso a tu cámara para escanear el QR.', camera_error: 'No se pudo iniciar la cámara. Intenta de nuevo.', network_error: 'No pudimos registrar tu check-in. Intenta de nuevo.' },
    },
  },
  en: {
    translation: {
      welcome: 'Welcome',
      common: { cancel: 'Cancel', go_home: 'Go home', try_again: 'Try again', yes: 'Yes', no: 'No', saving: 'Saving...' },
      nav: { home: 'Home', map: 'Map', chat: 'Chat', album: 'Album', profile: 'Profile' },
      explore: { greeting: 'Hello', search_placeholder: 'Search local flavors...', filters: { all: 'All', food: 'Food', crafts: 'Crafts', tours: 'Tours', art: 'Art', wellness: 'Wellness', commerce: 'Shops' }, near_you: 'Near you', no_results: 'No results' },
      auth: {
        register: {
          title: 'Create Account', subtitle_tourist: 'Tourist Registration', subtitle_owner: 'Step 1 of 3 - Personal Details', manual_separator: 'or manually', display_name_label: 'What should we call you?', display_name_placeholder: 'Ex. JuanTraveler26', email_label: 'Your best email', email_placeholder: 'juan@email.com', password_label: 'Password', password_placeholder: 'At least 8 characters', security_label: 'Security:', role_label: 'What are you looking for on the route?', tourist_title: 'Tourist', tourist_desc: 'I want to explore', owner_title: 'Owner', owner_desc: 'I have a business', language_label: 'App Language', terms_prefix: 'I accept the', terms_link: 'Terms and Conditions', terms_suffix: 'and the OLA MX privacy notice.', submit_loading: 'Creating account...', submit: 'Finish Registration', already_have: 'Already have an account?', sign_in: 'Sign in',
          strength: { weak: 'Too weak!', medium: 'Fair', strong: 'Unbreakable!' },
        },
        step2: {
          subtitle: 'Last step', title: 'Business Details', step_count: 'Step 3 / 3', location: 'Exact location', location_placeholder: 'Search for your business address...', loading_maps: 'Loading Google Maps...', city_detected: '✓ City detected:', cities: { cdmx: 'Mexico City', gdl: 'Guadalajara', mty: 'Monterrey' }, phone: 'Phone', optional: '(optional)', accepts_card: 'Accepts card', photos: 'Business photos', cover: 'cover', upload: 'Upload', photo_hint: 'The first photo will be your business cover.', uploading: 'Uploading photos...', saving: 'Saving business...', finalize: 'Complete Registration', review_notice: 'Your business will be under review until an admin approves it.\nWe will notify you when it is active on the map.', error_geocoding: 'Could not get coordinates. Try another address.', error_max_photos: 'Maximum 5 photos.', error_address: 'Select a valid address from the autocomplete.', error_card: 'Indicate if your business accepts cards.', error_photo: 'Upload at least one photo of your business.', error_upload: 'Error uploading image', error_generic: 'An error occurred while saving the business.',
        },
      },
      chat: {
        global: {
          title: 'Ola MX Assistant', online: 'Online', starting: 'Starting...', welcome: 'Hi! I am Ola, your World Cup assistant. Ask me about restaurants, your sticker passport, or what to do in the city.', error: 'Something went wrong while contacting the assistant. Please try again.', input_ready: 'Ask me anything about the World Cup...', input_loading: 'Starting...',
          quick_replies: { best_places: 'Which places are the best?', today_plan: 'What do you recommend for today?', passport: 'How does the passport work?', visit_places: 'Which places do you recommend visiting?' },
        },
      },
      checkin: { header: 'Visit Validator', greeting: 'Hello, Garnachero!', instructions: 'Scan the code to earn stamps and points.', btn_start: 'Start Scan', scanning_hud: 'SEARCHING FOR CODE...', syncing: 'Syncing with network...', welcome_back: 'Welcome back!', golden_checkin: 'Golden Check-in!', points_earned: 'Points earned', new_stamp: 'New Stamp', total_balance: 'Total balance:', btn_another: 'Another scan', btn_view_business: 'View Local', error_title: 'There was a problem', permission_error: 'We need access to your camera to scan the QR code.', camera_error: 'Could not start the camera. Please try again.', network_error: 'We could not register your check-in. Please try again.' },
    },
  },
  fr: {
    translation: {
      welcome: 'Bienvenue',
      common: { cancel: 'Annuler', go_home: "Retour à l'accueil", try_again: 'Réessayer', yes: 'Oui', no: 'Non', saving: 'Enregistrement...' },
      nav: { home: 'Accueil', map: 'Carte', chat: 'Chat', album: 'Album', profile: 'Profil' },
      explore: { greeting: 'Bonjour', search_placeholder: 'Rechercher des saveurs locales...', filters: { all: 'Tout', food: 'Nourriture', crafts: 'Artisanat', tours: 'Tours', art: 'Art', wellness: 'Bien-être', commerce: 'Boutiques' }, near_you: 'Près de chez vous', no_results: 'Aucun résultat' },
      auth: {
        register: {
          title: 'Créer un compte', subtitle_tourist: 'Inscription touriste', subtitle_owner: 'Étape 1 sur 3 - Données personnelles', manual_separator: 'ou manuellement', display_name_label: 'Comment devons-nous vous appeler ?', display_name_placeholder: 'Ex. JuanVoyageur26', email_label: 'Votre meilleur e-mail', email_placeholder: 'juan@email.com', password_label: 'Mot de passe', password_placeholder: 'Au moins 8 caractères', security_label: 'Sécurité :', role_label: 'Que cherchez-vous sur la route ?', tourist_title: 'Touriste', tourist_desc: 'Je veux explorer', owner_title: 'Propriétaire', owner_desc: "J'ai un commerce", language_label: "Langue de l'application", terms_prefix: "J'accepte les", terms_link: 'Conditions générales', terms_suffix: "et la politique de confidentialité OLA MX.", submit_loading: 'Création du compte...', submit: "Terminer l'inscription", already_have: 'Vous avez déjà un compte ?', sign_in: 'Se connecter',
          strength: { weak: 'Trop faible !', medium: 'Correct', strong: 'Imparable !' },
        },
        step2: {
          subtitle: 'Dernière étape', title: "Détails de l'entreprise", step_count: 'Étape 3 / 3', location: 'Emplacement exact', location_placeholder: "Rechercher l'adresse...", loading_maps: 'Chargement de Google Maps...', city_detected: '✓ Ville détectée :', cities: { cdmx: 'Mexico', gdl: 'Guadalajara', mty: 'Monterrey' }, phone: 'Téléphone', optional: '(optionnel)', accepts_card: 'Accepte les cartes', photos: "Photos de l'entreprise", cover: 'couverture', upload: 'Télécharger', photo_hint: "La première photo sera la couverture de votre entreprise.", uploading: 'Téléchargement des photos...', saving: "Enregistrement de l'entreprise...", finalize: "Terminer l'inscription", review_notice: "Votre entreprise sera en cours d'examen jusqu'à son approbation.\nNous vous informerons lorsqu'elle sera active.", error_geocoding: 'Coordonnées introuvables. Essayez une autre adresse.', error_max_photos: 'Maximum 5 photos.', error_address: 'Sélectionnez une adresse valide.', error_card: 'Indiquez si vous acceptez les cartes.', error_photo: 'Téléchargez au moins une photo.', error_upload: 'Erreur de téléchargement', error_generic: "Une erreur est survenue lors de l'enregistrement.",
        },
      },
      chat: {
        global: {
          title: 'Assistant Ola MX', online: 'En ligne', starting: 'Démarrage...', welcome: "Salut ! Je suis Ola, votre assistante pour la Coupe du monde. Demandez-moi des restaurants, votre passeport d'autocollants ou quoi faire en ville.", error: "Une erreur s'est produite en contactant l'assistant. Réessayez.", input_ready: 'Demandez-moi quelque chose sur la Coupe du monde...', input_loading: 'Démarrage...',
          quick_replies: { best_places: 'Quels sont les meilleurs endroits ?', today_plan: "Que recommandez-vous pour aujourd'hui ?", passport: 'Comment fonctionne le passeport ?', visit_places: 'Quels lieux recommandez-vous de visiter ?' },
        },
      },
      checkin: { header: 'Validateur de visite', greeting: 'Bonjour, Garnachero !', instructions: 'Scannez le code pour gagner des autocollants et des points.', btn_start: 'Commencer le scan', scanning_hud: 'RECHERCHE DU CODE...', syncing: 'Synchronisation avec le réseau...', welcome_back: 'Bon retour !', golden_checkin: 'Check-in doré !', points_earned: 'Points gagnés', new_stamp: 'Nouvel autocollant', total_balance: 'Total cumulé :', btn_another: 'Un autre scan', btn_view_business: 'Voir le lieu', error_title: 'Un problème est survenu', permission_error: "Nous avons besoin d'accéder à votre caméra pour scanner le QR.", camera_error: "Impossible de démarrer la caméra. Réessayez.", network_error: "Impossible d'enregistrer votre check-in. Réessayez." },
    },
  },
  pt: {
    translation: {
      welcome: 'Bem-vindo',
      common: { cancel: 'Cancelar', go_home: 'Voltar ao início', try_again: 'Tentar novamente', yes: 'Sim', no: 'Não', saving: 'Salvando...' },
      nav: { home: 'Início', map: 'Mapa', chat: 'Chat', album: 'Álbum', profile: 'Perfil' },
      explore: { greeting: 'Olá', search_placeholder: 'Buscar sabores locais...', filters: { all: 'Tudo', food: 'Comida', crafts: 'Artesanato', tours: 'Passeios', art: 'Arte', wellness: 'Bem-estar', commerce: 'Lojas' }, near_you: 'Perto de você', no_results: 'Nenhum resultado' },
      auth: {
        register: {
          title: 'Criar conta', subtitle_tourist: 'Cadastro de turista', subtitle_owner: 'Passo 1 de 3 - Dados pessoais', manual_separator: 'ou manualmente', display_name_label: 'Como devemos te chamar?', display_name_placeholder: 'Ex. JuanViajante26', email_label: 'Seu melhor e-mail', email_placeholder: 'juan@email.com', password_label: 'Senha', password_placeholder: 'Pelo menos 8 caracteres', security_label: 'Segurança:', role_label: 'O que você procura na rota?', tourist_title: 'Turista', tourist_desc: 'Quero explorar', owner_title: 'Dono', owner_desc: 'Tenho um negócio', language_label: 'Idioma do app', terms_prefix: 'Aceito os', terms_link: 'Termos e Condições', terms_suffix: 'e o aviso de privacidade da OLA MX.', submit_loading: 'Criando conta...', submit: 'Finalizar cadastro', already_have: 'Já tem uma conta?', sign_in: 'Entrar',
          strength: { weak: 'Muito fraca!', medium: 'Regular', strong: 'Imbatível!' },
        },
        step2: {
          subtitle: 'Último passo', title: 'Dados do Local', step_count: 'Passo 3 / 3', location: 'Localização exata', location_placeholder: 'Busque o endereço do seu negócio...', loading_maps: 'Carregando Google Maps...', city_detected: '✓ Cidade detectada:', cities: { cdmx: 'Cidade do México', gdl: 'Guadalajara', mty: 'Monterrey' }, phone: 'Telefone', optional: '(opcional)', accepts_card: 'Aceita cartão', photos: 'Fotos do local', cover: 'capa', upload: 'Enviar', photo_hint: 'A primeira foto será a capa do seu negócio.', uploading: 'Enviando fotos...', saving: 'Salvando negócio...', finalize: 'Finalizar Cadastro', review_notice: 'Seu negócio ficará em análise até que um administrador o aprove.\nAvisaremos quando estiver ativo no mapa.', error_geocoding: 'Não conseguimos obter as coordenadas. Tente outro endereço.', error_max_photos: 'Máximo de 5 fotos.', error_address: 'Selecione um endereço válido.', error_card: 'Indique se seu negócio aceita cartão.', error_photo: 'Envie pelo menos uma foto do local.', error_upload: 'Erro ao enviar imagem', error_generic: 'Ocorreu um erro ao salvar o negócio.',
        },
      },
      chat: {
        global: {
          title: 'Assistente Ola MX', online: 'Online', starting: 'Iniciando...', welcome: 'Olá! Sou a Ola, sua assistente da Copa. Pergunte sobre restaurantes, seu passaporte de figurinhas ou o que fazer na cidade.', error: 'Ocorreu um erro ao contactar a assistente. Tente novamente.', input_ready: 'Pergunte algo sobre a Copa...', input_loading: 'Iniciando...',
          quick_replies: { best_places: 'Quais são os melhores lugares?', today_plan: 'O que você recomenda para hoje?', passport: 'Como funciona o passaporte?', visit_places: 'Quais lugares você recomenda visitar?' },
        },
      },
      checkin: { header: 'Validador de visita', greeting: 'Olá, Garnachero!', instructions: 'Escaneie o código para ganhar figurinhas e pontos.', btn_start: 'Iniciar escaneamento', scanning_hud: 'PROCURANDO CÓDIGO...', syncing: 'Sincronizando com a rede...', welcome_back: 'Bem-vindo de volta!', golden_checkin: 'Check-in dourado!', points_earned: 'Pontos ganhos', new_stamp: 'Nova figurinha', total_balance: 'Total acumulado:', btn_another: 'Outro escaneamento', btn_view_business: 'Ver local', error_title: 'Houve um problema', permission_error: 'Precisamos de acesso à sua câmera para escanear o QR.', camera_error: 'Não foi possível iniciar a câmera. Tente novamente.', network_error: 'Não foi possível registrar seu check-in. Tente novamente.' },
    },
  },
  de: {
    translation: {
      welcome: 'Willkommen',
      common: { cancel: 'Abbrechen', go_home: 'Zur Startseite', try_again: 'Erneut versuchen', yes: 'Ja', no: 'Nein', saving: 'Speichern...' },
      nav: { home: 'Startseite', map: 'Karte', chat: 'Chat', album: 'Album', profile: 'Profil' },
      explore: { greeting: 'Hallo', search_placeholder: 'Lokale Aromen suchen...', filters: { all: 'Alle', food: 'Essen', crafts: 'Kunsthandwerk', tours: 'Touren', art: 'Kunst', wellness: 'Wellness', commerce: 'Geschäfte' }, near_you: 'In deiner Nähe', no_results: 'Keine Ergebnisse' },
      auth: {
        register: {
          title: 'Konto erstellen', subtitle_tourist: 'Touristenregistrierung', subtitle_owner: 'Schritt 1 von 3 - Persönliche Daten', manual_separator: 'oder manuell', display_name_label: 'Wie sollen wir dich nennen?', display_name_placeholder: 'Z. B. JuanReisender26', email_label: 'Deine beste E-Mail', email_placeholder: 'juan@email.com', password_label: 'Passwort', password_placeholder: 'Mindestens 8 Zeichen', security_label: 'Sicherheit:', role_label: 'Was suchst du auf der Route?', tourist_title: 'Tourist', tourist_desc: 'Ich möchte erkunden', owner_title: 'Inhaber', owner_desc: 'Ich habe ein Geschäft', language_label: 'App-Sprache', terms_prefix: 'Ich akzeptiere die', terms_link: 'Geschäftsbedingungen', terms_suffix: 'und den Datenschutzhinweis von OLA MX.', submit_loading: 'Konto wird erstellt...', submit: 'Registrierung abschließen', already_have: 'Hast du schon ein Konto?', sign_in: 'Anmelden',
          strength: { weak: 'Zu schwach!', medium: 'Mittel', strong: 'Unschlagbar!' },
        },
        step2: {
          subtitle: 'Letzter Schritt', title: 'Geschäftsdetails', step_count: 'Schritt 3 / 3', location: 'Genauer Standort', location_placeholder: 'Suchen Sie Ihre Geschäftsadresse...', loading_maps: 'Laden von Google Maps...', city_detected: '✓ Stadt erkannt:', cities: { cdmx: 'Mexiko-Stadt', gdl: 'Guadalajara', mty: 'Monterrey' }, phone: 'Telefon', optional: '(optional)', accepts_card: 'Akzeptiert Karten', photos: 'Geschäftsfotos', cover: 'Titelbild', upload: 'Hochladen', photo_hint: 'Das erste Foto wird Ihr Titelbild sein.', uploading: 'Fotos werden hochgeladen...', saving: 'Geschäft wird gespeichert...', finalize: 'Registrierung abschließen', review_notice: 'Ihr Geschäft wird geprüft, bis ein Administrator es genehmigt.\nWir benachrichtigen Sie, wenn es auf der Karte aktiv ist.', error_geocoding: 'Koordinaten konnten nicht abgerufen werden. Versuchen Sie eine andere Adresse.', error_max_photos: 'Maximal 5 Fotos.', error_address: 'Wählen Sie eine gültige Adresse aus.', error_card: 'Geben Sie an, ob Sie Karten akzeptieren.', error_photo: 'Laden Sie mindestens ein Foto hoch.', error_upload: 'Fehler beim Hochladen', error_generic: 'Beim Speichern des Geschäfts ist ein Fehler aufgetreten.',
        },
      },
      chat: {
        global: {
          title: 'Ola MX Assistent', online: 'Online', starting: 'Wird gestartet...', welcome: 'Hallo! Ich bin Ola, dein WM-Assistent. Frag mich nach Restaurants, deinem Sticker-Pass oder was du in der Stadt machen kannst.', error: 'Beim Kontakt mit dem Assistenten ist ein Fehler aufgetreten. Bitte versuche es erneut.', input_ready: 'Frag mich etwas über die Weltmeisterschaft...', input_loading: 'Wird gestartet...',
          quick_replies: { best_places: 'Welche Orte sind die besten?', today_plan: 'Was empfiehlst du für heute?', passport: 'Wie funktioniert der Pass?', visit_places: 'Welche Orte empfiehlst du zum Besuchen?' },
        },
      },
      checkin: { header: 'Besuchsprüfung', greeting: 'Hallo, Garnachero!', instructions: 'Scanne den Code, um Sticker und Punkte zu erhalten.', btn_start: 'Scan starten', scanning_hud: 'CODE WIRD GESUCHT...', syncing: 'Synchronisierung mit dem Netzwerk...', welcome_back: 'Willkommen zurück!', golden_checkin: 'Goldener Check-in!', points_earned: 'Verdiente Punkte', new_stamp: 'Neuer Sticker', total_balance: 'Gesamtsaldo:', btn_another: 'Noch ein Scan', btn_view_business: 'Ort ansehen', error_title: 'Es gab ein Problem', permission_error: 'Wir benötigen Zugriff auf deine Kamera, um den QR-Code zu scannen.', camera_error: 'Die Kamera konnte nicht gestartet werden. Bitte versuche es erneut.', network_error: 'Dein Check-in konnte nicht registriert werden. Bitte versuche es erneut.' },
    },
  },
  zh: {
    translation: {
      welcome: '欢迎',
      common: { cancel: '取消', go_home: '返回首页', try_again: '再试一次', yes: '是', no: '否', saving: '保存中...' },
      nav: { home: '首页', map: '地图', chat: '聊天', album: '相册', profile: '个人资料' },
      explore: { greeting: '你好', search_placeholder: '搜索当地风味...', filters: { all: '全部', food: '美食', crafts: '手工艺品', tours: '旅游', art: '艺术', wellness: '健康', commerce: '商店' }, near_you: '在你附近', no_results: '没有结果' },
      auth: {
        register: {
          title: '创建账户', subtitle_tourist: '游客注册', subtitle_owner: '第 1 步，共 3 步 - 个人信息', manual_separator: '或手动填写', display_name_label: '我们应该怎么称呼你？', display_name_placeholder: '例如 JuanTraveler26', email_label: '你的最佳邮箱', email_placeholder: 'juan@email.com', password_label: '密码', password_placeholder: '至少 8 个字符', security_label: '安全性：', role_label: '你在这条路线中想做什么？', tourist_title: '游客', tourist_desc: '我想探索', owner_title: '商家', owner_desc: '我有一家店', language_label: '应用语言', terms_prefix: '我接受', terms_link: '条款与条件', terms_suffix: '以及 OLA MX 的隐私政策。', submit_loading: '正在创建账户...', submit: '完成注册', already_have: '已经有账户了吗？', sign_in: '登录',
          strength: { weak: '太弱了！', medium: '一般', strong: '非常强！' },
        },
        step2: {
          subtitle: '最后一步', title: '商家详情', step_count: '第 3 步，共 3 步', location: '准确位置', location_placeholder: '搜索您的商家地址...', loading_maps: '正在加载 Google 地图...', city_detected: '✓ 检测到城市：', cities: { cdmx: '墨西哥城', gdl: '瓜达拉哈拉', mty: '蒙特雷' }, phone: '电话', optional: '(可选)', accepts_card: '接受信用卡', photos: '商家照片', cover: '封面', upload: '上传', photo_hint: '第一张照片将作为商家的封面。', uploading: '正在上传照片...', saving: '正在保存商家...', finalize: '完成注册', review_notice: '您的商家将接受审核，直到管理员批准。\n当地图上激活时，我们会通知您。', error_geocoding: '无法获取坐标，请尝试其他地址。', error_max_photos: '最多 5 张照片。', error_address: '请从自动填充中选择一个有效地址。', error_card: '请注明是否接受信用卡。', error_photo: '请至少上传一张商家照片。', error_upload: '上传图片时出错', error_generic: '保存商家时出错。',
        },
      },
      chat: {
        global: {
          title: 'Ola MX 助手', online: '在线', starting: '正在启动...', welcome: '你好！我是 Ola，你的世界杯助手。你可以问我餐厅、贴纸护照，或者城市里可以做什么。', error: '联系助手时发生错误，请再试一次。', input_ready: '问我任何和世界杯有关的问题...', input_loading: '正在启动...',
          quick_replies: { best_places: '哪些地方最好？', today_plan: '你推荐我今天做什么？', passport: '护照系统怎么用？', visit_places: '你推荐参观哪些地方？' },
        },
      },
      checkin: { header: '到店验证', greeting: '你好，Garnachero！', instructions: '扫描二维码即可获得贴纸和积分。', btn_start: '开始扫描', scanning_hud: '正在寻找代码...', syncing: '正在与网络同步...', welcome_back: '欢迎回来！', golden_checkin: '黄金签到！', points_earned: '获得积分', new_stamp: '新贴纸', total_balance: '累计总分：', btn_another: '再次扫描', btn_view_business: '查看商家', error_title: '出现了问题', permission_error: '我们需要访问你的相机来扫描二维码。', camera_error: '无法启动相机，请再试一次。', network_error: '无法记录你的签到，请再试一次。' },
    },
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('preferredLang') || 'es',
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
