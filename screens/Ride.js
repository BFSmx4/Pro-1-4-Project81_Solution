import React, { Component } from "react";
import {
    View,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Text,
    ImageBackground,
    Image,
    Alert,
    KeyboardAvoidingView,
    ToastAndroid
} from "react-native";
import * as Permissions from "expo-permissions";
import { BarCodeScanner } from "expo-barcode-scanner";
import firebase from "firebase";
import db from "../config";

const bgImage = require("../assets/background2.png");
const appIcon = require("../assets/appIcon.png");

export default class RideScreen extends Component {
    constructor(props) {
        super(props);
        this.state = {
            bikeId: "",
            userId: "",
            domState: "normal",
            hasCameraPermissions: null,
            scanned: false,
            bikeType: "",
            userName: ""
        };
    }

    getCameraPermissions = async () => {
        const { status } = await Permissions.askAsync(Permissions.CAMERA);

        this.setState({
            /*estado === "concedido" es verdadero cuando el usuario ha concedido el permiso.
                estado === "concedido" es falso cuando el usuario no ha concedido el permiso.
              */
            hasCameraPermissions: status === "granted",
            domState: "scanner",
            scanned: false
        });
    };

    handleBarCodeScanned = async ({ type, data }) => {
        this.setState({
            bikeId: data,
            domState: "normal",
            scanned: true
        });
    };

    handleTransaction = async () => {
        var { bikeId, userId } = this.state;
        await this.getBikeDetails(bikeId);
        await this.getUserDetails(userId);

        // Comprueba la disponibilidad de la bicicleta usando la función 'checkBikeAvailability()' y pasándola la argumento 'bikeId'. Almacena el estado en una variable 'transactionType'
        var transactionType = await this.checkBikeAvailability(bikeId);
        // Comprueba si la variable 'transactionType' está vacía
        if (!transactionType) {
            // Si 'transactionType' está vacía, haz que el valor de 'bikeId' sea ""
            this.setState({ bikeId: "" });
            // Haz una alerta emergente en la pantalla para ingresa el id de la bicileta. válido.
            Alert.alert("Ingresa/escanea un id de bicileta válido");
        } else if (transactionType === "under_maintenance") {
            this.setState({
                bikeId: ""
            });
        } else if (transactionType === "rented") {
            
                var { bikeType, userName } = this.state;
                this.assignBike(bikeId, userId, bikeType, userName);
                Alert.alert(
                    "Haz rentado la bicileta por una hora. ¡Disfruta tu viaje!"
                );
                this.setState({
                    bikeAssigned: true
                });

                // Solo para usuarios Android
                // ToastAndroid.show(
                //   "¡Haz rentado la bicicleta por una hora. ¡Disfruta tu viaje!",
                //   ToastAndroid.SHORT
                // );
            
        } else {
            
                var { bikeType, userName } = this.state;
                this.returnBike(bikeId, userId, bikeType, userName);
                Alert.alert("Esperamos que hayas disfrutado tu viaje");
                this.setState({
                    bikeAssigned: false
                });

                // Solo para usuarios Android
                // ToastAndroid.show(
                //   "Esperamos que hayas disfrutado tu viaje.",
                //   ToastAndroid.SHORT
                // );
            
        }
    };

    getBikeDetails = bikeId => {
        bikeId = bikeId.trim();
        db.collection("bicycles")
            .where("id", "==", bikeId)
            .get()
            .then(snapshot => {
                snapshot.docs.map(doc => {
                    this.setState({
                        bikeType: doc.data().bike_type
                    });
                });
            });
    };

    getUserDetails = userId => {
        db.collection("users")
            .where("id", "==", userId)
            .get()
            .then(snapshot => {
                snapshot.docs.map(doc => {

                    
                    this.setState({
                    userName: doc.data().name,
                    userId: doc.data().id,
                    bikeAssigned: doc.data().bike_assigned
                    });


                });
            });
    };

    checkBikeAvailability = async bikeId => {
        const bikeRef = await db
            .collection("bicycles")
            .where("id", "==", bikeId)
            .get();

        var transactionType = "";
        if (bikeRef.docs.length == 0) {
            transactionType = false;
        } else {
            bikeRef.docs.map(doc => {
                
                if (!doc.data().under_maintenance) {
                    //Si la bicicleta está disponible entonces el tipo de transacción será rentar, de lo contrario, será devolver.

                    transactionType = doc.data().is_bike_available ?
                        "rented" : "return";



                } else {
                    transactionType = "under_maintenance";
                    Alert.alert(doc.data().maintenance_message);
                }
            });
        }

        return transactionType;
    };

    
    assignBike = async (bikeId, userId, bikeType, userName) => {
        //agrega una transacción
        db.collection("transactions").add({
            user_id: userId,
            user_name: userName,
            bike_id: bikeId,
            bike_type: bikeType,
            date: firebase.firestore.Timestamp.now().toDate(),
            transaction_type: "rented"
        });
        //cambia el estado de la bicicleta
        db.collection("bicycles")
            .doc(bikeId)
            .update({
                is_bike_available: false
            });
        //cambia el valor de la bicicleta asignada al usuario
        db.collection("users")
            .doc(userId)
            .update({
                bike_assigned: true
            });

        // Actualizando estado local
        this.setState({
            bikeId: ""
        });
    };

    returnBike = async (bikeId, userId, bikeType, userName) => {
        //agrega una transacción
        db.collection("transactions").add({
            user_id: userId,
            user_name: userName,
            bike_id: bikeId,
            bike_type: bikeType,
            date: firebase.firestore.Timestamp.now().toDate(),
            transaction_type: "return"
        });
        //cambia el estado de la bicicleta
        db.collection("bicycles")
            .doc(bikeId)
            .update({
                is_bike_available: true
            });
        //cambia el valor de la bicicleta asignada al usuario
        db.collection("users")
            .doc(userId)
            .update({
                bike_assigned: false
            });

        // Actualizando el estado local
        this.setState({
            bikeId: ""
        });
    };

    render() {
        const { bikeId, userId, domState, scanned, bikeAssigned } = this.state;
        if (domState !== "normal") {
            return (
                <BarCodeScanner
                    onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
                    style={StyleSheet.absoluteFillObject}
                />
            );
        }
        return (
            <KeyboardAvoidingView behavior="padding" style={styles.container}>
                <View style={styles.upperContainer}>
                    <Image source={appIcon} style={styles.appIcon} />
                    <Text style={styles.title}>e-ride</Text>
                    <Text style={styles.subtitle}>Un viaje eco-friendly</Text>
                </View>
                <View style={styles.lowerContainer}>
                    <View style={styles.textinputContainer}>
                        <TextInput
                            style={[styles.textinput, { width: "82%" }]}
                            onChangeText={text => this.setState({ userId: text })}
                            placeholder={"Id del usuario"}
                            placeholderTextColor={"#FFFFFF"}
                            value={userId}
                        />
                    </View>
                    <View style={[styles.textinputContainer, { marginTop: 25 }]}>
                        <TextInput
                            style={styles.textinput}
                            onChangeText={text => this.setState({ bikeId: text })}
                            placeholder={"Id de la bicicleta"}
                            placeholderTextColor={"#FFFFFF"}
                            value={bikeId}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={styles.scanbutton}
                            onPress={() => this.getCameraPermissions()}
                        >
                            <Text style={styles.scanbuttonText}>Escanear</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { marginTop: 25 }]}
                        onPress={this.handleTransaction}
                    >
                        <Text style={styles.buttonText}>
                            {bikeAssigned ? "Terminar viaje" : "Unlock"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#D0E6F0"
    },
    bgImage: {
        flex: 1,
        resizeMode: "cover",
        justifyContent: "center"
    },
    upperContainer: {
        flex: 0.5,
        justifyContent: "center",
        alignItems: "center"
    },
    appIcon: {
        width: 200,
        height: 200,
        resizeMode: "contain",
        marginTop: 80
    },
    title: {
        fontSize: 40,
        fontFamily: "Rajdhani_600SemiBold",
        paddingTop: 20,
        color: "#4C5D70"
    },
    subtitle: {
        fontSize: 20,
        fontFamily: "Rajdhani_600SemiBold",
        color: "#4C5D70"
    },
    lowerContainer: {
        flex: 0.5,
        alignItems: "center"
    },
    textinputContainer: {
        borderWidth: 2,
        borderRadius: 10,
        flexDirection: "row",
        backgroundColor: "#4C5D70",
        borderColor: "#4C5D70"
    },
    textinput: {
        width: "57%",
        height: 50,
        padding: 10,
        borderColor: "#4C5D70",
        borderRadius: 10,
        borderWidth: 3,
        fontSize: 18,
        backgroundColor: "#F88379",
        fontFamily: "Rajdhani_600SemiBold",
        color: "#FFFFFF"
    },
    scanbutton: {
        width: 100,
        height: 50,
        backgroundColor: "#FBE5C0",
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        justifyContent: "center",
        alignItems: "center"
    },
    scanbuttonText: {
        fontSize: 24,
        color: "#4C5D70",
        fontFamily: "Rajdhani_600SemiBold"
    },
    button: {
        width: "43%",
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FBE5C0",
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#4C5D70"
    },
    buttonText: {
        fontSize: 24,
        color: "#4C5D70",
        fontFamily: "Rajdhani_600SemiBold"
    }
});
