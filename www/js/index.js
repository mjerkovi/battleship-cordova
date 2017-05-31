
var app = function() {

    var self = {};
    self.is_configured = false;

    var server_url = "https://luca-ucsc-teaching-backend.appspot.com/keystore/";
    var call_interval = 2000;

    Vue.config.silent = false; // show all warnings

    // Extends an array
    self.extend = function(a, b) {
        for (var i = 0; i < b.length; i++) {
            a.push(b[i]);
        }
    };

    self.my_identity = randomString(20);

    self.null_board =   [" ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " ",
                        " ", " ", " ", " ", " ", " ", " ", " "];

    // Enumerates an array.
    var enumerate = function(v) {
        var k=0;
        v.map(function(e) {e._idx = k++;});
    };

    // Initializes an attribute of an array of objects.
    var set_array_attribute = function (v, attr, x) {
        v.map(function (e) {e[attr] = x;});
    };

    self.initialize = function () {
        document.addEventListener('deviceready', self.ondeviceready, false);
    };

    self.ondeviceready = function () {
        // This callback is called once Cordova has finished its own initialization.
        console.log("The device is ready");

        $("#vue-div").show();
        self.is_configured = true;
    };

    self.player_1 = null;
    self.player_2 = null;

    function call_server() {
        console.log("Calling the server");
        if (self.vue.chosen_magic_word === null) {
            console.log("No magic word.");
            setTimeout(call_server, call_interval);
        } else {
            // We can do a server call.
            $.ajax({
                dataType: 'json',
                url: server_url +'read',
                data: {key: self.vue.chosen_magic_word},
                success: self.process_server_data,
                complete: setTimeout(call_server, call_interval) // Here we go again.
            });
        }
    }

    // Main function for sending the state.
    self.send_state = function () {
        $.post(server_url + 'store',
            {
                key: self.vue.chosen_magic_word,
                val: JSON.stringify(
                    {
                        'player_1': self.player_1,
                        'player_2': self.player_2,
                        'player1_board': self.vue.player1_board,
                        'player2_board': self.vue.player2_board,
                        'turn_counter': self.vue.turn_counter
                    }
                )
            }
        );
    };

    self.process_server_data = function (data) {
        if (!data.result) {
            self.player_1 = self.my_identity;
            self.player_2 = null;
            self.vue.player1_board = getBoard();
            self.vue.player2_board = self.null_board;
            self.vue.is_my_turn = false;
            self.vue.turn_counter = 0;
            self.send_state();
        }
        // the server already has the magic word stored so the result is not null.
        // although may not be "our" game if there was a conflict with the magic word.
        else {
            self.server_answer = JSON.parse(data.result);
            self.player_1 = self.server_answer.player_1;
            self.player_2 = self.server_answer.player_2;
            //one or both of the players are missing
            if (self.player_1 === null || self.player_2 === null) {
                self.vue.is_my_turn = false;
                if (self.player_1 === self.my_identity || self.player_2 === self.my_identity) {
                    console.log("Waiting for other player to join");
                    self.vue.intruding = false;
                } else {
                    console.log("Signing up now.");
                    if (self.player_1 === null) {
                        self.player_1 = self.my_identity;
                        self.vue.player1_board = getBoard();
                        self.vue.player2_board = self.server_answer.player2_board;
                        self.send_state();
                    } else if (self.player_2 === null) {
                        self.player_2 = self.my_identity;
                        // i am now player_2 so i must set up my board and push it to the server
                        self.vue.player2_board = getBoard();
                        self.vue.player1_board = self.server_answer.player1_board;
                        self.send_state();
                    } else {
                        console.log("Oops intruding1");
                        self.vue.need_new_magic_word = true;
                        self.vue.intruding = true;
                    }
                }
            }
            // both players are there
            else {
                // but i am not one of the players, so i must be
                // so i must be intruding on someone elses game
                if (self.player_1 !== self.my_identity && self.player_2 !== self.my_identity) {
                    console.log("Oops intruding2");
                    self.vue.need_new_magic_word = true;
                    self.vue.intruding = true;
                } else {
                    // okay now i am in the appropriate game and both players are here
                    self.vue.is_other_present = true;
                    self.update_local_vars(self.server_answer);
                }
            }
        }
    }

    self.update_local_vars = function (server_answer) {
        if (server_answer.player_1 === self.my_identity) {
            self.vue.my_role = "player_1";
        } else if (server_answer.player_2 === self.my_identity) {
            self.vue.my_role = "player_2";
        } else {
            self.vue.my_role = "";
        }

        // the server response is the most up to date
        if (self.vue.turn_counter <= server_answer.turn_counter) {
            self.vue.player1_board = server_answer.player1_board;
            self.vue.player2_board = server_answer.player2_board;
            self.vue.turn_counter = server_answer.turn_counter;
        } else if (self.vue.turn_counter > server_answer.turn_counter) {
            // local state is most up to date, so send it to the server
            self.send_state();
        }

        if (((self.vue.turn_counter % 2) === 0) && self.vue.my_role === "player_1") {
            self.vue.is_my_turn = true;
        } else if (((self.vue.turn_counter % 2) !== 0) && self.vue.my_role === "player_2") {
            self.vue.is_my_turn = true;
        } else {
            self.vue.is_my_turn = false;
        }
    }




    self.magic_word_prefix = "lololyawdadadayada596";

    self.set_magic_word = function () {
        self.vue.chosen_magic_word = self.magic_word_prefix.concat(self.vue.magic_word);
        self.vue.need_new_magic_word = false;
        // Resets board and turn.
        self.vue.board = self.null_board;
        self.vue.is_my_turn = false;
        self.vue.my_identity = "";
    };

    self.play = function(i, j) {
        if (!self.vue.is_my_turn) {
            console.log("Not your turn");
            return;
        }
        var opponent_board = null;
        if (self.vue.my_role === "player_1") {
            opponent_board = self.vue.player2_board;
        } else {
            opponent_board = self.vue.player1_board;
        }

        console.log(opponent_board);

        // you clicked on water so just change the * -> w to indicate a miss
        if (opponent_board[i * 8 + j] === '*') {
            console.log("Hit water");
            opponent_board[i * 8 + j] = 'w';
        } else if (opponent_board[i * 8 + j] < 0) {
            // if the spot that was clicked contains an integer that is less than zero
            // then that location has already been shot at. so return without incrementing
            // the turn counter
            console.log("Ship already hit");
            return;
        } else {
            // there is a non-negative integer in spot i, j so negate it
            // to indicate that the spot has been hit
            opponent_board[i * 8 + j] = -opponent_board[i * 8 + j];
        }

        if (self.vue.my_role === 'player_1') {
            self.vue.player2_board = opponent_board;
        } else {
            self.vue.player1_board = opponent_board;
        }

        // check if game is won either here or on a server get
        ++self.vue.turn_counter;
        self.vue.is_my_turn = false;


        self.send_state();

    }

        //checks for valid placement of ship of ship_size in a board_size x board_size at (x,y) with orientatation (0->horizontal, 1-> vertical)
    function isvalid(board, x, y, orientation, ship_size, board_size){
        if(orientation){
            if(x+ship_size >= board_size) return false;
            for(var i = x; i < x+ship_size; i++){
                if(board[i][y] != '*' ||
                    (y-1 >= 0 && board[i][y-1] != '*') || // to ensure that ships do not "touch each other"
                    (y+1 < board_size && board[i][y+1] != '*'))
                        return false;
            }
            if((x - 1 >= 0 && board[x-1][y] != '*') ||
                (x + ship_size < board_size && board[x+ship_size][y] != '*')) return false;
        } else {
            if(y+ship_size >= board_size) return false;
            for(var i = y; i < y+ship_size; i++){
                if(board[x][i] != '*' ||
                    (x-1 >= 0 && board[x-1][i] != '*') || // to ensure that ships do not "touch each other"
                    (x+1 < board_size && board[x+1][i] != '*'))
                        return false;
            }
            if((y-1 >= 0 && board[x][y-1] != '*') ||
                (y+ship_size < board_size && board[x][y+ship_size] != '*')) return false;
        }
        return true;
    }

    function print(board){
        var size = Math.sqrt(board.length);
        for(var i = 0; i < size; i++){
            var s = "";
            for(var j = 0; j < size; j++){
                s += board[i*size + j];
            }
            console.log(s);
        }
    }

    //creates a ship in board with shipid
    function setShip(board, orientation, x, y, ship_size, shipid){
        if(orientation){
            for(var i = x; i < x+ship_size; i++){
                board[i][y] = shipid;
            }
        }else{
            for(var i = y; i < y+ship_size; i++){
                board[x][i] = shipid;
            }
        }
    }

    //get random integers in range [Min, Max]
    function get_random(Min, Max){
        return Math.floor(Math.random() * (Max - Min +1)) + Min;
    }

    //create a ship
    function createShip(board, board_size, ship_size, shipid){
        var counter=0;
        while(counter < 200){
            counter++;
            var orientation = get_random(0, 1);//0 -> horizontal, 1-> vertical
            var x=0;
            var y=0;
            if(orientation){
                x = get_random(0, board_size-ship_size-1);
                y = get_random(0, board_size-1);
            }else{
                x = get_random(0, board_size-1);
                y = get_random(0, board_size-ship_size-1);
            }
            if(!isvalid(board, x, y, orientation, ship_size, board_size)) continue; //check if it conflicts
            setShip(board, orientation, x, y, ship_size, shipid);
            break;
        }
    }

    //create all ships
    function createShips(board, board_size){
        var ships = [[1,3], [3,1], [2,2]]; // first element of every pair is number of ships, second element is length of ship
        var shipid = 1;
        for(var i = 0; i < ships.length; i++){
            for(var count = 0; count < ships[i][0]; count++){
                createShip(board, board_size, ships[i][1], shipid);
                shipid++;
            }
        }
    }

    //flatten 2d vector to 1d vector
    function flatten(board){
        var size = board.length;
        var board2 = new Array(size*size);
        for(var i = 0; i < size; i++){
            for(var j = 0; j < size; j++)
                board2[i*size + j] = board[i][j];
        }
        return board2;
    }

    // get 8x8 board flattened
    function getBoard(){
        var size = 8;
        var board = new Array(size);
        for (var i = 0; i < size; i++) {
            board[i] = new Array(size);
            for (var j = 0; j < size; j++)
                board[i][j] = '*';
        }
        createShips(board, size);
        board = flatten(board);
        return board;
    }

    self.vue = new Vue({
        el: "#vue-div",
        delimiters: ['${', '}'],
        unsafeDelimiters: ['!{', '}'],
        data: {
            magic_word: "",
            chosen_magic_word: null,
            need_new_magic_word: false,
            my_role: "",
            player1_board: self.null_board,
            player2_board: self.null_board,
            is_other_present: false,
            is_my_turn: false,
            intruding: false,
            turn_counter: null
        },
        methods: {
            set_magic_word: self.set_magic_word,
            play: self.play

        }

    });

    call_server();

    return self;
};

var APP = null;

// This will make everything accessible from the js console;
// for instance, self.x above would be accessible as APP.x
jQuery(function(){
    APP = app();
    APP.initialize();
});
