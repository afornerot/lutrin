#!/bin/bash

TPUT=/usr/bin/tput
#test si TPUT est utilisable
if [ ! "$TERM" = "" ] && $TPUT hpa 60 >/dev/null 2>&1 && $TPUT setaf 1  >/dev/null 2>&1; then
    FANCYTTY=1
else
    FANCYTTY=0
fi

Pause() {
if [ "$ModeTxt" == "yes" ];then
    echo
elif [ "$ModeEad" == "yes" ];then
    echo "<br>"
else
    [ $FANCYTTY = 1 ] && $TPUT setaf 6
    echo " Appuyez sur Entrée pour continuer ..."
    [ $FANCYTTY = 1 ] && $TPUT sgr0
    read BiDon
fi
}

Echo() {
if [ "$ModeEad" != "yes" ];
then
    echo "$1"
else
    echo "$1<br>"
fi
}

EchoColor() {
if [ "$ModeTxt" = "yes" ];then
    echo "$1"
elif [ "$ModeEad" = "yes" ];then
    echo "<FONT color=\"$3\"> $1 </FONT><br>"
else
    [ "$FANCYTTY" = 1 ] && $TPUT setaf $2
    echo "$1"
    [ "$FANCYTTY" = 1 ] && $TPUT sgr0
fi
}

EchoRouge() {
    EchoColor "$1" "1" "red"
}

EchoVert() {
    EchoColor "$1" "2" "green"
}

EchoOrange() {
    EchoColor "$1" "3" "orange"
}

EchoBleu() {
    EchoColor "$1" "4" "blue"
}

EchoMagenta() {
    EchoColor "$1" "5" "magenta"
}

EchoCyan() {
    EchoColor "$1" "6" "cyan"
}

EchoBlanc() {
    EchoColor "$1" "7" "white"
}

EchoGras() {
if [ "$ModeTxt" == "yes" ];then
    echo "$1"
elif [ "$ModeEad" == "yes" ];then
    echo "<b> $1 </b><br>"
else
    [ $FANCYTTY = 1 ] && $TPUT bold
    echo "$1"
    [ $FANCYTTY = 1 ] && $TPUT sgr0
fi
}

Clear() {
if [ "$ModeEad" != "yes" -a "$ModeTxt" != "yes" ];then
    clear
fi
}

Question_ouinon() {
    #attention, il faut synchroniser les modifications avec /usr/share/pyshared/pyeole/ihm.py
    question=$1
    [ "$2" = "" ] && interactive='True' || interactive=$2
    [ "$3" = "" ] && default="non" || default=$3
    [ "$4" = "" ] && level="info" || level=$4
    [ "$5" = "" ] && default_uninteractive=$default || default_uninteractive=$5
    [ ! "$interactive" = "True" ] && [ ! "$interactive" = "False" ] && echo "Question_ouinon : interactive doit être True ou False" && exit 1
    [ ! "$default" = "oui" ] && [ ! "$default" = "non" ] && echo "Question_ouinon : default doit etre oui ou non" && exit 1
    [ ! "$default_uninteractive" = "oui" ] && [ ! "$default_uninteractive" = "non" ] && echo "Question_ouinon : default_uninteractive doit etre oui ou non" && exit 1
    [ ! "$level" = "info" ] && [ ! "$level" = "warn" ] && [ ! "$level" = "err" ] && echo "Question_ouinon : level doit etre info, warn ou err" && exit 1
    #non interactive
    if [ "$interactive" = "False" ]; then
        Rep=default_uninteractive
    else
        question="$question [oui/non]"
        if [ $level = "info" ]; then
            echo "$question"
        elif [ $level = "warn" ]; then
            EchoOrange "$question"
        else
            EchoRouge "$question"
        fi
        echo -n "[$default] : "
        read Rep
        #passe en minuscule
        Rep=`echo $Rep | tr A-Z a-z`
    fi
    if [ "$default" = "non" ]; then
        if [ "$Rep" = "oui" -o "$Rep" = "o" -o "$Rep" = "yes" -o "$Rep" = "y" ];then
            return 0
        else
            return 1
        fi
    else
        if [ "$Rep" = "non" -o "$Rep" = "n" -o "$Rep" = "no" ];then
            return 1
        else
            return 0
        fi
    fi
}

EchoStart() {
    for i in $(eval echo "{1..30}")
    do    
        ligne+="="
    done
    clear
}

BigTitle(){
    size=`tput cols`
    nb=${#1}
    nbchar=$(($size - $nb - 4)) 

    ligne=""
    for i in $(eval echo "{1..$size}")
    do    
        ligne+="="
    done

    finligne=""
    for i in $(eval echo "{1..$nbchar}")
    do    
        finligne+="="
    done
    
    echo
    EchoVert $ligne
    EchoVert "== $1 $finligne" 
    EchoVert $ligne
    echo
}

Title(){
    size=`tput cols`
    nb=${#1}
    nbchar=$(($size - $nb - 4)) 

    ligne=""
    for i in $(eval echo "{1..$size}")
    do    
        ligne+="="
    done

    finligne=""
    for i in $(eval echo "{1..$nbchar}")
    do    
        finligne+="="
    done
    
    echo
    EchoCyan "== $1 $finligne" 
    echo
}

TitleSimple(){
    size=`tput cols`
    nb=${#1}
    nbchar=$(($size - $nb - 4)) 

    ligne=""
    for i in $(eval echo "{1..$size}")
    do    
        ligne+="="
    done

    finligne=""
    for i in $(eval echo "{1..$nbchar}")
    do    
        finligne+="="
    done
    
    EchoCyan "== $1 $finligne" 
}