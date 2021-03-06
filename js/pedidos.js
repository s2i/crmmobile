$(document).on("pageinit", function() {
    $("#bt_consultar_pedidos").on("click", function( b ) {
        b.preventDefault();
        _pedidos.all(this);
    });
    $(".bt_pedido_finalzar").on("click", function( b ) {
        b.preventDefault();
        _pedidos.finalizar();
    });

    $("#bt_adicionar_produtos").on("click", function( b ) {
        b.preventDefault();
        _pedidos.add();
    });

    $("#bt_adicionar_parcelas").on("click", function( b ) {
        b.preventDefault();
        _pedidos.parcela();
    });

    $(".select_produtos").on("click", function( b ) {
        b.preventDefault();
        _produtos.select($(this).attr('cod_produto'));
        $('.ui-listview-filter').find(':input').val('');
        $('#autocomplete').html('');
        $ul.listview("refresh");
        $ul.trigger("updatelayout");
    });
    $("form, table").insere_mascara();
});
_produtos = {
};
_clientes = {
};
// constantes do objeto pedido
_pedidos = {
    total : 0,
    total_parcela : 0,
    qtd_itens : 0,
    qtd_volume : 0,
    qtd_parcelas : 0,
    form : {
        dsc : '',
        cod : '',
        unidade : '',
        desconto : '',
        valor : '',
        id : '',
        quantidade : ''
    },
    parcelas : [ ]
}
// consulta pedido por filtro
_pedidos.all = function( obj ) {
    var and = {
        'p.id_empresas' : _session.get('id_empresas')
    };
    $(obj).closest('form').find(':input').each(function() {
        switch ( this.name ) {
            case 'codigo_pedido':
                if ( $.trim($(this).val()) != '' ) {
                    and['p.id_pedidos'] = $(this).val();
                }
                break;

            case 'cliente':
                if ( $.trim($(this).val()) != '' ) {
                    and['c.dsc_cliente LIKE'] = $(this).val();
                }
                break;

            case 'data':
                if ( $.trim($(this).val()) != '' ) {
                    and['date(p.data_hora_cadastro)'] = convert_date($(this).val());
                }
                break;

            case 'situacao_envio':
                if ( $.isNumeric($(this).val()) ) {
                    and['p.situacao_envio'] = $(this).val();
                }
                break;

            case 'situacao_pedido':
                if ( $.isNumeric($(this).val()) ) {
                    and['p.situacao_pedido'] = $(this).val();
                }
                break;
        }
    });
    _pedidos.consultar({
        where : and,
        options : {
            limit : 100,
            order : 'p.data_hora_cadastro DESC'
        }
    });
}

// consulta ultimos pedido
_pedidos.ultimos = function() {
    _pedidos.consultar({
        options : {
            limit : 100,
            order : 'p.data_hora_cadastro DESC'
        }
    });
}

// consulta pedidos e popula na view
_pedidos.consultar = function( condicoes ) {
    block(false);
    $("#table-consulta-pedidos tbody").html("");
    db2.select(
            'pedidos as p LEFT JOIN clientes as c on c.cod_cliente = p.id_clientes',
            'p.*, c.dsc_cliente, c.cod_cliente',
            condicoes,
            function( f ) {
                debug("TOTAL", f.rows.length);
                if ( f.rows.length == 0 ) {
                    jAviso("Nenum registro localizado.");
                } else {
                    for ( var e = 0; e < f.rows.length; e++ ) {
                        var v = f.rows.item(e);
                        var g = '<tr cod_cliente="' + v.cod_cliente + '">';
                        g += ' <th>' + v.dsc_cliente + '</th>';
                        g += ' <td>' + v.numero_pedido + '</td>';
                        g += ' <td>' + number_format(v.valor_total, 2, ',', '.') + '</td>';
                        g += ' <td>' + date('d/m/Y H:i:s', new Date(v.data_hora_cadastro)) + '</td>';
                        g += ' <td>' + _situacoes.pedido[v.situacao_pedido] + "</td>";
                        g += ' <td>' + _situacoes.sincronizacao[v.situacao_envio] + "</td>";
                        g += ' <td> <a href="#" data-role="button" data-icon="bars" data-theme="c" data-inline="true" class="bt_cliente_novo_pedido">Novo Pedido</a> </td>';
                        g += '</tr>';
                        $("#table-consulta-pedidos tbody").append(g);
                    }
                    atualiza_table();
                    $(".bt_cliente_novo_pedido").click(function( b ) {
                        b.preventDefault();
                        var cod_cliente = $(this).closest('tr').attr('cod_cliente');
                        _session.set("cod_cliente", cod_cliente);
                        _constant.redirect("pedidos_novo_01.html");
                    });
                }
                block(true);
            });
}


// adiciona produtos na view
_pedidos._add_table = function(  ) {
    $('table tr[id="' + _pedidos.form.id + '"]').remove();
    var g = '<tr id="' + _pedidos.form.id + '">';
    g += '<th>' + _pedidos.form.dsc + '</th>';
    g += '<td>' + _pedidos.form.cod + '</td>';
    g += '<td>' + _pedidos.form.unidade + '</td>';
    g += '<td>' + number_format(_pedidos.form.desconto, 2, ",", ".") + '</td>';
    g += '<td>' + _pedidos.form.quantidade + '</td>';
    g += '<td>' + number_format(_pedidos.form.valor, 2, ",", ".") + '</td>';
    g += '<td><a href="#" data-role="button" data-icon="minus" data-iconpos="notext" data-theme="e" data-inline="true" class="remove_produtos">Remover</a></td>';
    g += "</tr>";
    $("#table-itens-pedidos tbody").append(g);
    atualiza_table();
    $('#frm_novo_pedido_parte_2 :input').val('');
    $('input[data-type="search"]').val('');
    $('.remove_produtos').click(function( e ) {
        e.preventDefault();
        var obj = this;
        db2.destroy(
                'pedidos_itens',
                {
                    id_produtos : $(obj).closest('tr').attr('id')
                },
        function() {
            $('table tr[id="' + $(obj).closest('tr').attr('id') + '"]').remove();
            $('#frm_novo_pedido_parte_2 :input').val('');
            $('input[data-type="search"]').val('');
            atualiza_table();
            _pedidos.update_totais();
        }
        );

    });
}

// adiciona item ao pedido
_pedidos.insert = function() {
    db2.insert(
            'pedidos_itens',
            {
                id_pedidos : _session.get('id_pedidos'),
                id_produtos : _pedidos.form.id,
                data_hora_cadastro : date('Y-m-d H:i:s'),
                quantidade : _pedidos.form.quantidade,
                valor_unitario : _pedidos.form.valor,
                valor_desconto : _pedidos.form.desconto
            },
    function( ) {
        _pedidos._add_table();
        _pedidos.update_totais();
    });
}

// alterar item ao pedido
_pedidos.update = function( ) {

    db2.update(
            'pedidos_itens',
            {
                data_hora_cadastro : date('Y-m-d H:i:s'),
                quantidade : _pedidos.form.quantidade,
                valor_unitario : _pedidos.form.valor,
                valor_desconto : _pedidos.form.desconto
            },
    {
        id_pedidos : _session.get('id_pedidos'),
        id_produtos : _pedidos.form.id
    },
    function( ) {
        _pedidos._add_table();
        _pedidos.update_totais();
    });
}
// adiciona todos os produtos do carrinho na view
_pedidos.add_all = function() {
    db2.select(
            'pedidos_itens as pi JOIN produtos as p ON pi.id_produtos = p.id_produtos',
            'pi.*, p.dsc_produto, p.cod_produto, p.unidade',
            {
                where : {
                    id_empresas : _session.get('id_empresas'),
                    id_pedidos : _session.get('id_pedidos')
                }
            },
    function( f ) {
        for ( var e = 0; e < f.rows.length; e++ ) {
            var v = f.rows.item(e);
            _pedidos.form = {
                dsc : v.dsc_produto,
                cod : v.cod_produto,
                unidade : v.unidade,
                desconto : v.valor_desconto,
                valor : v.valor_unitario,
                id : v.id_produtos,
                quantidade : v.quantidade
            };
            _pedidos._add_table();
        }
        _pedidos.update_totais();
    });
}
// atualiza totais
_pedidos.update_totais = function() {
    db2.select(
            'pedidos_itens',
            '*',
            {
                where : {
                    id_pedidos : _session.get('id_pedidos')
                }
            },
    function( f ) {
        _pedidos.total = 0;
        _pedidos.qtd_itens = 0;
        _pedidos.qtd_volume = 0;
        if ( f.rows.length > 0 ) {
            for ( var e = 0; e < f.rows.length; e++ ) {
                var v = f.rows.item(e);
                _pedidos.total += (v.quantidade * (v.valor_unitario - v.valor_desconto));
                _pedidos.qtd_itens += v.quantidade;
                _pedidos.qtd_volume++;
            }
        }
        $('#total_produtos_pedido').html(_pedidos.qtd_volume);
        $('#total_produtos_itens_pedido').html(_pedidos.qtd_itens);
        $('#valor_total_pedido').html(number_format(_pedidos.total, 2, ",", "."));

        db2.update(
                'pedidos',
                {
                    valor_total : _pedidos.total
                },
        {
            id_pedidos : _session.get('id_pedidos'),
            id_clientes : _session.get('cod_cliente')
        },
        function( ) {
        });

    });
}

// adiciona produtos no pedido
_pedidos.add = function() {
    _pedidos.form = {
        dsc : $('#frm_novo_pedido_parte_2').find('#dsc_produto_produto').val(),
        cod : $('#frm_novo_pedido_parte_2').find('#cod_produto_produto').val(),
        unidade : $('#frm_novo_pedido_parte_2').find('#unidade_produto').val(),
        desconto : convert_moeda($('#frm_novo_pedido_parte_2').find('#desconto_produto').val() || '0,00'),
        valor : $('#frm_novo_pedido_parte_2').find('#valor_produto').val(),
        id : $('#frm_novo_pedido_parte_2').find('#id_produtos_produto').val(),
        quantidade : ($('#frm_novo_pedido_parte_2').find('#quantidade_produto').val() || '1')
    };

    if ( _session.get('id_pedidos') != null ) {
        db2.select(
                'pedidos_itens',
                '*',
                {
                    where : {
                        id_pedidos : _session.get('id_pedidos'),
                        id_produtos : _pedidos.form.id
                    }
                },
        function( f ) {
            if ( f.rows.length != 0 ) {
                _pedidos.form.quantidade = parseInt(_pedidos.form.quantidade) + parseInt(f.rows.item(0).quantidade);
                _pedidos.update();
            } else {
                _pedidos.insert();
            }
        });
    } else {
        _pedidos.novo();
    }
}

// adiciona parcelas ao db
_pedidos.parcela_add = function() {
    $('#table-pagamentos-pedidos tbody').html('');
    var tl = _pedidos.parcelas.length - 1;
    $.each(_pedidos.parcelas, function( a, b ) {
        db2.insert(
                'pedidos_pagamentos',
                b,
                function( f ) {
                    var v = '<tr id="' + b.parcela + '" forma="' + b.forma + '" data_vencimento="' + date('d/m/Y', new Date(b.vencimento).getTime() / 1000) + '" valor="' + number_format(b.valor, 2, ",", ".") + '">';
                    v += '<th>' + _situacoes.pedido_pagamentos[b.forma] + '</th>';
                    v += '<td>' + date('d/m/Y', new Date(b.vencimento).getTime() / 1000) + '</td>';
                    v += '<td>' + number_format(b.valor, 2, ",", ".") + '</td>';
                    v += '<td>';
                    v += '<a href="#" data-role="button" data-icon="minus" data-iconpos="notext" data-theme="e" data-inline="true" class="bt_remove_parcela">Remover</a>';
                    v += '<a href="#dialogPage" data-ajax="true" data-role="button" data-icon="edit" data-iconpos="notext" data-theme="e" data-inline="true"  data-rel="dialog" class="bt_edit_parcela">Editar</a>';
                    v += '</td>';
                    v += '</tr>';
                    $('#table-pagamentos-pedidos tbody').append(v);
                    if ( a == tl ) {
                        atualiza_table();
                        $('.bt_edit_parcela').click(function() {
                            var obj = this;
                            var pid = $(obj).closest('tr').attr('id');
                            var pforma = $(obj).closest('tr').attr('forma');
                            var pdv = $(obj).closest('tr').attr('data_vencimento');
                            var pv = $(obj).closest('tr').attr('valor');
                            $("#dialogPage").dialog({
                                closeBtn : "none",
                                create : function( event, ui ) {
                                    $('#parcela_edit').find('#parcela').val(pid);
                                    $('#parcela_edit').find('#forma_pagamnento').val(pforma);
                                    $('#parcela_edit').find('#data_vencimento').val(pdv);
                                    $('#parcela_edit').find('#valor').val(pv);
                                    atualiza_table();
                                    $('#bt_atualizar_parcela').click(function( e ) {
                                        e.preventDefault();
                                        _pedidos.total_parcela = parseFloat((_pedidos.total - convert_moeda($('#parcela_edit').find('#valor').val())) / (_pedidos.qtd_parcelas - 1));
                                        for ( var i = 0; i < _pedidos.qtd_parcelas; i++ ) {
                                            if ( _pedidos.parcelas[i].parcela == pid ) {
                                                _pedidos.parcelas[i].forma = parseInt($('#parcela_edit').find('#forma_pagamnento').val());
                                                _pedidos.parcelas[i].vencimento = convert_date($('#parcela_edit').find('#data_vencimento').val()).toString();
                                                _pedidos.parcelas[i].valor = convert_moeda($('#parcela_edit').find('#valor').val());
                                            } else {
                                                _pedidos.parcelas[i].valor = _pedidos.total_parcela;
                                            }
                                        }
                                        db2.destroy('pedidos_pagamentos', "id_pedidos = '" + _session.get('id_pedidos') + "'", function() {
                                            _pedidos.parcela_update();
                                        });

                                    });
                                }
                            });
                        });
                        $(".bt_remove_parcela").on("click", function( b ) {
                            b.preventDefault();
                            $('#frm_novo_pedido_parte_3').find('#numero_parcelas').val(parseInt($('#frm_novo_pedido_parte_3').find('#numero_parcelas').val()) - 1);
                            _pedidos.parcela();
                        });
                    }
                }
        );
    });
};

// adiciona parcelas ao db
_pedidos.parcela_update = function() {
    var tl = _pedidos.parcelas.length - 1;
    $.each(_pedidos.parcelas, function( a, b ) {
        db2.insert(
                'pedidos_pagamentos',
                b,
                function( f ) {
                    if ( a == tl ) {
                        _constant.redirect('pedidos_novo_03.html');
                    }
                }
        );
    });
};

// adiciona parcelas no pedido
_pedidos.parcela = function() {
    var erros = 0;
    var msg = '';

    if ( !parseInt($('#frm_novo_pedido_parte_3').find('#numero_parcelas').val()) ) {
        erros++;
        msg += 'Número de parcelas não informado <br />';
    }

    if ( !parseInt($('#frm_novo_pedido_parte_3').find('#forma_pagamnento').val()) ) {
        erros++;
        msg += 'Forma de pagamento não informado <br />';
    }

    if ( !parseInt($('#frm_novo_pedido_parte_3').find('#condicoes_pagamnento').val()) ) {
        erros++;
        msg += 'Condições de pagamento não informado <br />';
    }

    if ( erros == 0 ) {
        $('#table-pagamentos-pedidos tbody').html('');
        db2.destroy(
                'pedidos_pagamentos', "id_pedidos = '" + _session.get('id_pedidos') + "'",
                function( ) {
                    db2.select(
                            'pedidos_pagamentos',
                            '*',
                            {
                                where : {
                                    id_pedidos : _session.get('id_pedidos')
                                }
                            },
                    function( f ) {
                        debug("TOTAL", f.rows.length);
                        if ( f.rows.length == 0 ) {
                            var npar = 1;
                            var cp = parseInt($('#frm_novo_pedido_parte_3').find('#condicoes_pagamnento').val());
                            if ( cp == 1 ) {
                                _pedidos.total_parcela = _pedidos.total;
                                var d = new Date();
                            } else {
                                _pedidos.total_parcela = parseFloat(_pedidos.total / parseInt($('#frm_novo_pedido_parte_3').find('#numero_parcelas').val()));
                                var d = new Date();
                                d.setMonth(d.getMonth() + 1);
                                npar = parseInt($('#frm_novo_pedido_parte_3').find('#numero_parcelas').val());
                            }
                            _pedidos.qtd_parcelas = npar;
                            _pedidos.parcelas = [ ];
                            for ( var i = 1; i <= npar; i++ ) {
                                _pedidos.parcelas.push({
                                    id_pedidos : _session.get('id_pedidos'),
                                    parcela : i,
                                    forma : parseInt($('#frm_novo_pedido_parte_3').find('#forma_pagamnento').val()),
                                    vencimento : date('Y-m-d', d.getTime() / 1000),
                                    valor : _pedidos.total_parcela
                                });
                                d.setMonth(d.getMonth() + 1);
                            }
                            _pedidos.parcela_add();
                        } else {
                            _pedidos.parcela();
                        }
                    });
                });
    } else {
        jAviso(msg);
    }
}

// adiciona parcelas no pedido
_pedidos.parcela_all = function() {

    db2.select(
            'pedidos_pagamentos',
            '*',
            {
                where : {
                    id_pedidos : _session.get('id_pedidos')
                }
            },
    function( f ) {
        debug("TOTAL", f.rows.length);
        if ( f.rows.length != 0 ) {
            _pedidos.parcelas = [ ];
            _pedidos.qtd_parcelas = 0;
            for ( var i = 0; i < f.rows.length; i++ ) {
                var v = f.rows.item(i);
                _pedidos.parcelas.push({
                    id_pedidos : v.id_pedidos,
                    parcela : v.parcela,
                    forma : v.forma,
                    vencimento : v.vencimento,
                    valor : v.valor
                });
                _pedidos.qtd_parcelas++;
            }
            _pedidos.total_parcela = parseFloat(_pedidos.total / _pedidos.qtd_parcelas);
            if ( _pedidos.qtd_parcelas > 0 ) {
                if ( _pedidos.qtd_parcelas == 1 ) {
                    $('#frm_novo_pedido_parte_3 #condicoes_pagamnento').val(1);
                } else if ( _pedidos.qtd_parcelas > 1 ) {
                    $('#frm_novo_pedido_parte_3 #condicoes_pagamnento').val(2);
                }
                $('#frm_novo_pedido_parte_3 #numero_parcelas').val(_pedidos.qtd_parcelas);
                $('#frm_novo_pedido_parte_3 #forma_pagamnento').val(_pedidos.parcelas[0].forma);
                atualiza_table();
            }
            db2.destroy(
                    'pedidos_pagamentos', "id_pedidos = '" + _session.get('id_pedidos') + "'", function() {
                _pedidos.parcela_add();
            });

        }
    });

}

// gera no pedido
_pedidos.novo = function() {
    db2.insert(
            'pedidos',
            {
                id_empresas : _session.get('id_empresas'),
                id_clientes : _session.get('cod_cliente'),
                id_usuarios : _session.get('cod_usuario'),
                data_hora_cadastro : date('Y-m-d H:i:s'),
                numero_pedido : '',
                observacao : '',
                situacao_envio : 3,
                situacao_pedido : 1,
                valor_total : '0.00'
            },
    function( f ) {
        _session.set('id_pedidos', f.insertId);
        _pedidos.add();
    }
    );
}

// finalizar no pedido
_pedidos.finalizar = function() {
    db2.update(
            'pedidos',
            {
                valor_total : _pedidos.total,
                observacao : $('#observacao').val(),
                situacao_envio : 3,
                situacao_pedido : 5
            },
    {
        id_pedidos : _session.get('id_pedidos')
    },
    function( ) {
        jSucesso('Pedido Finalizado com sucesso.');
        _session.remove('id_pedidos');
        _session.remove('cod_cliente');
        _constant.redirect('pedidos_consultar.html')
    });
}
_pedidos.calcula = function( v, d, q ) {
    var sub = v - d;
    var mult = sub * q;
    return mult
}

// resumo do pedido
_pedidos.resumo = function() {
    // itens
    db2.select('pedidos_itens as pi JOIN produtos as p ON pi.id_produtos = p.id_produtos', 'pi.*, p.dsc_produto, p.cod_produto, p.unidade', {
        where : {
            id_empresas : _session.get('id_empresas'),
            id_pedidos : _session.get('id_pedidos')
        }
    },
    function( f ) {
        for ( var e = 0; e < f.rows.length; e++ ) {
            var v = f.rows.item(e);
            var g = '<tr>';
            g += '<th>' + v.dsc_produto + '</th>';
            g += '<td>' + v.cod_produto + '</td>';
            g += '<td>' + v.unidade + '</td>';
            g += '<td>' + number_format(v.valor_unitario, 2, ",", ".") + '</td>';
            g += '<td>' + number_format(v.desconto, 2, ",", ".") + '</td>';
            g += '<td>' + v.quantidade + '</td>';
            g += '<td>' + number_format(_pedidos.calcula(v.valor_unitario, v.valor_desconto, v.quantidade), 2, ",", ".") + '</td>';
            g += "</tr>";
            $("#table-resumo-pedidos-itens tbody").append(g);
        }
    });

    // pagamentos
    db2.select('pedidos_pagamentos', '*', {
        where : {
            id_pedidos : _session.get('id_pedidos')
        }
    },
    function( f ) {
        for ( var e = 0; e < f.rows.length; e++ ) {
            var v = f.rows.item(e);
            var g = '<tr>';
            g += '<th>' + _situacoes.pedido_pagamentos[v.forma] + '</th>';
            g += '<td>' + date('d/m/Y', new Date(v.vencimento)) + '</td>';
            g += '<td>' + number_format(v.valor, 2, ",", ".") + '</td>';
            g += "</tr>";
            $("#table-resumo-pedidos-forma-pagamento tbody").append(g);
        }
    });
}

// consulta ultimos pedidos do cliente
_pedidos.get_all = function() {
    _session.remove('id_pedidos');

    db2.select(
            'pedidos',
            '*',
            {
                where : {
                    id_clientes : _session.get('cod_cliente'),
                    id_empresas : _session.get('id_empresas')
                },
                option : {
                    limit : 5,
                    order : 'data_hora_cadastro DESC',
                }
            },
    function( f ) {
        debug("TOTAL", f.rows.length);
        for ( var e = 0; e < f.rows.length; e++ ) {

            var v = f.rows.item(e);
            if ( v.situacao_pedido == 1 ) {
                _session.set('id_pedidos', v.id_pedidos);
            }
            var g = '<tr>';
            g += '<th>' + v.numero_pedido + '</th>';
            g += '<td>' + _situacoes.pedido[v.situacao_pedido] + '</td>';
            g += '<td>' + _situacoes.sincronizacao[v.situacao_envio] + '</td>';
            g += '<td> R$ ' + number_format(v.valor_total, 2, ",", ".") + '</td>';
            g += '<td>' + date("d/m/Y H:i:s", new Date(v.data_hora_cadastro)) + '</td>';
            g += "</tr>";
            $("#ultimos-pedidos tbody").append(g);
        }
        atualiza_table();
    });
}

// consulta cliente
_clientes.get = function() {
    db2.select(
            'clientes',
            '*',
            {
                where : {
                    id_empresas : _session.get('id_empresas'),
                    cod_cliente : _session.get('cod_cliente')
                }
            },
    function( f ) {
        debug("TOTAL", f.rows.length);
        $.each(f.rows.item(0), function( z, x ) {
            if ( z == 'data_hora_atualizacao' ) {
                x = date("d/m/Y H:i:s", new Date(x));
                $('#' + z).html(x);
            } else if ( z == 'valor_devido' ) {
                x = number_format(x, 2, ",", ".");
                $('#' + z).html(x);
                if ( x != '0,00' ) {
                    $('#' + z).css('color', 'red');
                }
            } else if ( z == 'situacao' ) {
                x = _situacoes.clientes[x.situacao]
                $('#' + z).html(x);
            } else {
                $('#' + z).html(x);
            }
        });
        atualiza_table();
        _pedidos.get_all();
    });
}

// consulta produtos
_produtos.get = function() {
    $("#autocomplete").on("listviewbeforefilter", function( e, data ) {
        var $ul = $(this),
                $input = $(data.input),
                value = $input.val(),
                html = "";
        $ul.html("");
        if ( value && value.length > 1 ) {
            $ul.html("<li><div class='ui-loader'><span class='ui-icon ui-icon-loading'></span></div></li>");
            $ul.listview("refresh");
            var a = '(dsc_produto LIKE "%' + value + '%" OR cod_produto LIKE "%' + value + '%") AND id_empresas = "' + _session.get('id_empresas') + '" ';

            db2.select(
                    'produtos',
                    '*',
                    {
                        where : a,
                        options : {
                            limit : 100,
                            order : 'data_hora_atualizacao'
                        }
                    },
            function( f ) {
                debug("TOTAL", f.rows.length);
                if ( f.rows.length == 0 ) {
                    jAviso("Nenum registro localizado.");
                } else {
                    for ( var e = 0; e < f.rows.length; e++ ) {
                        var v = f.rows.item(e);
                        html += '<li id_produtos="' + v.id_produtos + '" class="select_produtos">' + v.cod_produto + ' | ' + v.dsc_produto + '</li>';
                    }
                    $ul.html(html);
                    $ul.listview("refresh");
                    $ul.trigger("updatelayout");
                    $(".select_produtos").on("click", function( b ) {
                        b.preventDefault();
                        _produtos.select($(this).attr('id_produtos'));
                        $(".select_produtos").remove();
                    });
                }
            });
        }
    });
}

// seleciona produtos
_produtos.select = function( id_produtos ) {
    db2.select(
            'produtos',
            '*',
            {
                where : {
                    id_empresas : _session.get('id_empresas'),
                    id_produtos : id_produtos
                }
            },
    function( f ) {
        debug("TOTAL", f.rows.length);
        $.each(f.rows.item(0), function( z, x ) {
            $('#frm_novo_pedido_parte_2').find('#' + z + '_produto').val(x);
            debug('LINHA', z + ' === ' + x);
        });
        $('input[data-type="search"]').val(f.rows.item(0).cod_produto + ' | ' + f.rows.item(0).dsc_produto);
        $('#frm_novo_pedido_parte_2').find('#quantidade_produto').focus();
    });
}
// atualiza tabelas
atualiza_table = function() {
    $('.ui-table-cell-label').remove();
    $('.table-stroke').each(function() {
        $(this).table("refresh");
        $(this).find('a').buttonMarkup({
            inline : true,
            iconpos : "notext",
            theme : "c"
        });
    });
    $("table :input").not('.select_parcelas').textinput({
        mini : true
    });
    $('.select_parcelas').selectmenu({
        mini : true,
        nativeMenu : false
    }).selectmenu("refresh", true);

    $("form, table").insere_mascara();

    $(".moeda").maskMoney({
        symbol : '',
        thousands : '.',
        decimal : ',',
        symbolStay : false
    });
    $(".qtd").maskMoney({
        symbol : '',
        precision : 0,
        thousands : '',
        decimal : '',
        symbolStay : false
    });
}
