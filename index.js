const express = require('express'); //Se llaman los paquetes necesarios
const session = require('express-session');
socket = require('socket.io');
mysql = require('mysql');
cookieParser = require('cookie-parser');


var app = express();
var roomName= '';//Datos para el cambio de sala
const nameBot= "System";//Datos para el bot de notificaciones en el chat

var server = app.listen(3030, function () { //Conexion al servidor
  console.log("Servidor en marcha, port 3030.");
});

var io = socket(server);


var sessionMiddleware = session({//Sifrado de contraseñas
  secret: "keyUltraSecret",
  resave: true,
  saveUninitialized: true
});

io.use(function (socket, next) {//Funcion del socket.io
  sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);
app.use(cookieParser());

const config = {//Conecxion de la base de datos
  "host": "localhost",
  "user": "root",
  "password": "",
  "base": "chat_progra"
};

var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'chat_progra'
});

db.connect(function (err) {
  if (!!err)
  throw err;

  console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base);
});

app.use(express.static('./'));

io.on('connection', function (socket) {
  var req = socket.request;
  console.log(req.session);
	if(req.session.userID != null){//Se comprueba la sesion iniciada
		db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){
			console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.Username);
			socket.emit("logged_in", {user: req.session.Username, email: req.session.correo});
		});
	}else{
		console.log('No hay sesión iniciada');
	}
	socket.on("login", function(data){
	  const user = data.user,
	  pass = data.pass;
	  roomID = data.roomID;//Se agregan los datos de las salas al iniciar sesion
	  roomName = data.roomName;
	  db.query("SELECT * FROM users WHERE Username=?", [user], function(err, rows, fields){
		  if(rows.length == 0){//Se verifica que el susuario exista, si no se notifica
		  	console.log("El usuario no existe, favor de registrarse!");
		  }else{
		  		console.log(rows);
		  		const dataUser = rows[0].Username,
			  	dataPass = rows[0].Password,
			  	dataCorreo = rows[0].email;
				if(dataPass == null || dataUser == null){
				  	socket.emit("error");
				}
				if(user == dataUser && pass == dataPass){//Se encontro al usuario y se mandan los datos encontrados al socket
					console.log("Usuario correcto!");
					socket.emit("logged_in", {user: user, email: dataCorreo, room: roomName, roomID: roomID});
					req.session.userID = rows[0].id;
					req.session.Username = dataUser;
					req.session.correo = dataCorreo;
					req.session.roomID = roomID;
					req.session.roomName = roomName;
					req.session.save();
					socket.join(req.session.roomName);
					bottxt('entroSala');
				}else{
				  	socket.emit("invalido");
				}
		  }
	  });
	});
	
	socket.on('addUser', function(data){//Se crea la funcion para añadir usuarios
		const user = data.user,
		pass = data.pass,
		email = data.email;
		
		if(user != "" && pass != "" && email != ""){//Se toman los datos en caso de introducir un nuevo usuario
			console.log("Registrando el usuario: " + user);
		  	db.query("INSERT INTO users(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
			  if(!!err)
			  throw err;
			  console.log(result);
			  console.log('Usuario ' + user + " se dio de alta correctamente!.");
			  socket.emit('UsuarioOK');
			});
		}else{
			socket.emit('vacio');
		}
	});
	
	socket.on('cambiodesala', function(data){//Funcion para el cambio de sala dentro del chat
		const idSala =data.idSala,
		nombreSala = data.nombreSala;

		socket.leave(req.session.roomName);

		req.session.roomID = idSala;
		req.session.roomName = nombreSala;

		socket.join(req.session.roomName);
		bottxt('cambioSala');
	});

	socket.on('mjsNuevo', function(data){ // Función para crear el mensaje nuevo.		
		//const sala = 0; // definimos el id de la sala para posterior función.
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, req.session.roomID], function(err, result){
			  if(!!err)
			  throw err;

			  console.log('Mensaje dado de alta correctamente!.');
			  		socket.broadcast.to(req.session.roomName).emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
					socket.emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
			});
	});
	socket.on('getSalas', function(data){//Funcion para obtener los datos de las salas de la base de datos
		db.query('SELECT id, nombre_sala FROM salas', function(err, result,fields){
			if(err) throw err;
			socket.emit('Salas', result);
		})
	})

	socket.on('salir', function(request, response){
		bottxt('salioUsuario');
		socket.leave(req.session.roomName);
		req.session.destroy();
	});
	function bottxt(data){//funcion de un bot para notificar los cambios de sala
		entroSala = 'Bienvanido a la sala ' + req.session.roomName;
		cambioSala = 'Cambiaste a la sala ' + req.session.roomName;
		sefue = 'El usuario ' + req.session.Username + ' ha salido.';
	
		if(data == "entroSala"){
			socket.emit('mensaje', {
				usuario: nameBot,
				mensaje: entroSala
			});
		}
		if(data == "cambioSala"){
			socket.emit('mensaje', {
				usuario: nameBot,
				mensaje: cambioSala
			});
		}
		if(data == "salioUsuario"){
			socket.emit('mensaje', {
				usuario: nameBot,
				mensaje: sefue
			});
		}
	}
});