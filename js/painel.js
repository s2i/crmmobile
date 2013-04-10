$(document).on("pageinit", function() {
    if ( _session.get("usuario") != "" && _session.get("usuario") != undefined && _session.get("usuario") != null ) {
        $(".crm_mobile_atutenticacao").html("Usuário: " + _session.get("usuario"));
        if(_session.get('nivel') == 1){
            $('.painel_extra').show();
        }
    } else {
        window.location.href = 'index.html';
    }
    $(".logout").click(function( a ) {
        a.preventDefault();
        _session.clear();
        _constant.redirect("login.html");
    });
    $(".limpar_banco_dados").click(function( a ) {
        a.preventDefault();
        verificar_tabelas();
        _session.clear();
    });
});