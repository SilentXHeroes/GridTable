function gridTable($table, options) {

    /*
     * Paramétrage par défaut
     */
    var defaults = {
        columnUniqueID: "fakeId", // Identifiant unique d'une ligne
        rows: [], // Données
        theme: '', // Thème du tableau (change seulement la couleur de fond des lignes)
        sortBy: '', // Tri du tableau
        sortable: false, // Le tri est actif
        rowsCheckable: true, // Définit si on utilise les checkbox
        multipleSelection: true, // Autorise la sélection de plusieurs lignes
        globalSelection: true, // Autorise ou non la sélection globale
        showTotalSelectedRows: true, // Affichage du total de lignes sélectionnées
        selectAll: false, // Sélectionne toutes les lignes après initialisation
        hideHeaders: false, // Cache les en-têtes du tableau
        hideFooter: false, // Cache les informations du nombre d'éléments sélectionnés
        hideSelectableColumn: false, // Cache la colonne des inputs pour la sélection
        groups: false, // Autorise le groupement de données
        onlyGroups: false, // Les données contiennent seulement des groupes, on affiche seulement ces derniers
        collapseGroups: false, // Cache tous les groupes après initialisation
        totalGroupsCol: '', // Taille du groupe si rows contient l'information ( seulement si onlyGroups à TRUE sinon récupère la longueur des lignes )
        preventRowsFromGroupSelection: false, // Détermine si la sélection du groupe affecte la sélection des lignes
        disableNodeRowsSelection: false, // Désactive la sélection des lignes au clique sur la ligne
        onSelectedRow: '', // Evènement à la sélection d'une ligne (ne fais rien par défaut)
        onRowsPrint: '', // A la création des lignes
        onSelectedRowsCountChange: '', // Evènement au changement du nombre total de lignes sélectionnées (ne fais rien par défaut)
        emptyDataMessage: '', // Texte du message à afficher lorsqu'aucune donnée n'est présente dans le tableau
        fitColumnLengthToBody: false, // Redimensionne les colonnes lors de l'utilisation de la fonction << resize >>
        allowColumnResizing: false, // Indique si les colonnes sont redimensionnables
        editable: true, // Active ou non la saisie pour les colonnes éditables
        enableSubHeads: false, // Ajoute une ligne sous les en-têtes des colonnes (leur contenu est gérable depuis les options des colonnes)
        rowHeight: 25, // Hauteur des lignes
        fullTheme: false, // Applique le thème pour le header et footer
        autoSizeColumns: false, // Calcul la taille minimale pour chaque colonne en fonction de son contenu

        // Redimensionnement du tableau ( prend la hauteur de son containeur par défaut )
        resize: function () {
            if (typeof $table !== "undefined" && typeof $tbody !== "undefined") {
                var availableSpace = $table.parent().height();

                $table.siblings().each(function () {
                    availableSpace -= $(this).outerHeight(true);
                });

                return availableSpace - 5;
            }
        },

        // Texte affiché pour le total
        totalFormatter: function (rows) {
            var several = rows.selected > 1 ? 's' : '';
            return rows.total === 0 ? "Aucun &eacute;l&eacute;ment" : '<span>' + rows.selected + '</span>/<span>' + rows.total + '</span> ligne' + several + ' s&eacute;lectionn&eacute;e' + several;
        },

        // Formatteur de groupe
        groupFormatter: function (group) {
            return group.nom + ' - <span class="_selected_rows">' + group._selected_rows_count + '</span>/<span class="_total_rows">' + group._total + '</span>';
        },

        // Applique des éléments à la ligne
        metadata: function (id, row) {}
    };

    var defaultColumn = {
        width: 150,         // Largeur par défaut des colonnes
        checkable: false,   // Colonne sélectionnable
        checked: false,     // Colonne sélectionnée par défaut
        click: false,       // Au click de la colonne
        justif: 'L',        // Justification des cellules
        sum: false,         // Affiche la somme des cellules
        editor: false,      // Type de champ de la colonne
        editorAlwaysVisible: false, // Indique si le champ affichera toujours son editor
        onChange: false,            // Trigger au changement de valeur de l'editor
        class: '',          // Classe à ajouter à la cellule
        header: {
            justif: 'L',    // Alignement du texte du header
            content: '',    // Contenu à ajouter au header
            class: '',      // Classe à ajouter à l'élément 'p' du header
            attribute: ''
        },
        formatter: function (index, value) {
            return value;
        },
        sumFormatter: function (total) {
            return total;
        }
    };

    var headerColCheckbox;
    var rowsColCheckbox;

    var $thead;
    var $tbody;
    var $groups;
    var $tfoot;

    var settings;
    var textCellsWidth;     // Longueurs des cellules du tableau

    var _table = {
        width: 0,
        row_height: 40,
        currentScrollTop: 0,
        currentScrollLeft: 0,
        onScrollEnding: 0,
        range: {
            start: 0,
            end: 0
        }
    };
    var _columns = {
        data: {
            items: [],
            ordered: []
        },
        colspans: {
            items: [],
            columns: {}
        },
        autoSize: null
    };
    var _rows = {
        isUpdateProcessing: false,
        data: {
            items: [],      // Données complètes
            filtered: [],   // Données affichées à l'écran
            print: [],      // Données affichées à l'écran
            printIdxs: {},  // Indexes des données
            selected: [],   // Identifiants des données sélectionnées
            group_id: {},   // Identifiant du groupe auquel appartient les données
            idxs: {}
        }
    };
    var _row = {};
    var _column = {};
    var _groups = {
        data: {
            items: [],
            selected: []    // Indexes des groupes sélectionnées
        },
        formatter: false
    };    

    var ID = Math.floor(Math.random() * 9999); // Identifiant unique du tableau
    var columnID;
    var input_type = "radio";
    var col_moving = false;
    var preventFromDrop = false;        // Annule l'affichage des lignes
    var preventFromCollapse = false;    // Empêche de cacher les lignes
    var didAutoSizeColumn = false; // Vérifie si le calcul de la largeur des colonnes a été effectué
    
    // Classe gérant les appels aux évènements
    var subscribe = class {
        constructor() {
            this.callers = [];
        };
        subscribe(caller) {
            this.callers.push(caller);
        }
        call(...args) {
            this.callers.forEach(caller => caller(...args));
        }
    };

    /* EVENTS HANDLERS */

    var onRowsPrint          = new subscribe;
    var onColumnResized      = new subscribe;
    var onClickRow           = new subscribe;
    var onGlobalSelection    = new subscribe;
    var onGroupDrop          = new subscribe;
    var onGroupCollapse      = new subscribe;
    var onRowUpdate          = new subscribe;
    var onEditCell           = new subscribe;
    var onBeforeEditCell     = new subscribe;
    var onBeforeCellChange   = new subscribe;
    var rowsMetadata         = new subscribe;
    var onSelectedRow        = new subscribe;
    var onSelectedRowsCountChange = new subscribe;

    


    /*
     *
     * FONCTIONS DU TABLEAU
     *
     */




    _table.resize = function(resize_columns = true) {
        var theadH = settings.hideHeaders ? 0 : $thead.outerHeight(true);
        var tfootH = settings.hideFooter ? 0 : $tfoot.outerHeight(true);

        var headerCheck     = $('#selectAllCB');
        var $firstChildH    = $thead.find('> div:nth-child(' + (headerColCheckbox + 1) + ')');
        var $firstChildB    = $tbody.find('.cb-row > div:nth-child(1)');
        var bodyCheckWidth  = settings.rowsCheckable === false ? 0 : $tbody.find('.cb-row > div:first-child').outerWidth();
        var paddingHeaders  = parseInt($firstChildH.css('padding-left')) + 
                              parseInt($firstChildH.css('padding-right')) +
                              parseInt($firstChildH.css('border-left')) + 
                              parseInt($firstChildH.css('border-right'));
        var addedPadding    = settings.rowsCheckable === false || settings.hideSelectableColumn ? 0 :
                                settings.globalSelection ? headerCheck.outerWidth() + parseInt(headerCheck.css('border-right')) :
                                     bodyCheckWidth + parseInt($firstChildB.css('padding-left'));

        _table.width = ($groups.width() * .995) - (paddingHeaders * _columns.data.items.length) - addedPadding;

        // Hauteur du tableau
        $tbody.css('height', settings.resize($table) - (theadH + tfootH));

        if (resize_columns) _table.setStyle();
    }

    /*
     * On recalcule le total des lignes sélectionnées
     */
    _table.printTotals = function(fromTotalCheckbox = false) {

        if (settings.rowsCheckable) {
            var _selected = _rows.data.selected.length;
            var _count = _rows.data.filtered.length;
            var _allSelected = _selected === _count;


            // On vérifie si toutes les lignes sont sélectionnées
            if (settings.globalSelection) {
                $thead.find('> div:first-child').prop('title', "Tout " + (_allSelected && _count > 0 ? "d\u00E9" : '') + "s\u00E9lectionner");

                if (fromTotalCheckbox === false && _count > 0) {
                    $thead.find('> div:first-child > input').prop('checked', _allSelected);
                }
            }

            if (settings.showTotalSelectedRows) {
                // On change les infos du footer
                $tfoot.find('> div').html(settings.totalFormatter({selected: _selected, total: _count}));
            }

        } else {

            for (var i in _columns.data.items) {
                formatColumnSum(_columns.data.items[i]);
            }

        }

    }

    function getCurrentEditor() {
        var current_editor = $groups.find(".editable.edit");
        return current_editor.length === 0 ? undefined : current_editor;
    }

    function destroyCurrentEditor() {
        var current_editor = getCurrentEditor();

        if(typeof current_editor !== "undefined") {
            var column = _columns.get(current_editor);
            var editor = getEditor(column);

            if (editor.permanent === false && editor.type !== "password") {
                current_editor.find("> input, > select").remove();
            }

            current_editor.removeClass("edit");
        }
    }
    
    // On définit le CSS appliqué pour chaque colonne
    _table.setStyle = function(set = "both") {
        var styleHeadsNode = document.querySelector("head > style#style-gridtable-heads");
        var styleBodyNode = document.querySelector("head > style#style-gridtable-body");
        var setHeads = set === "both" || set === "autoSizeColumns" || set === "heads";
        var setBody = set === "both" || set === "autoSizeColumns" || set === "body";

        if(setHeads && styleHeadsNode === null) {
            styleHeadsNode = document.createElement("style");
            document.querySelector("head").appendChild(styleHeadsNode);

            styleHeadsNode.id = "style-gridtable-heads";
            styleHeadsNode.type = "text/css";
            styleHeadsNode.setAttribute("rel", "stylesheet");
        }
        
        if(setBody && styleBodyNode === null) {
            styleBodyNode = document.createElement("style");
            document.querySelector("head").appendChild(styleBodyNode);

            styleBodyNode.id = "style-gridtable-body";
            styleBodyNode.type = "text/css";
            styleBodyNode.setAttribute("rel", "stylesheet");
        }
        
        var totalWidth = settings.rowsCheckable ? 20 : 0;
        var nextLeftPos = totalWidth;
        var style = { heads: '', body: '' };
        var gridTableCSS = '.gridTable-' + ID + ' ';
        var gridTableCSS = '.gridTable-' + ID + ' ';
        
        if(setHeads && _table.currentScrollLeft > 0) {
            style.heads += gridTableCSS + ".thead > div[row-selection] { left: -"+ _table.currentScrollLeft +"px; }";
        }
        if(setBody) {
            style.body += gridTableCSS +".cb-row, "+ gridTableCSS +".cb-group, "+ gridTableCSS +".cb-total { height: "+ _table.row_height +"px; } ";
            style.body += gridTableCSS +".cb-row > div, "+ gridTableCSS +".cb-group > div, "+ gridTableCSS +".cb-total > div { height: "+ _table.row_height +"px; line-height: "+ _table.row_height +"px; } ";
        }
        
        // Largeur auto des colonnes
        if(set === "autoSizeColumns") {
            _columns.autoSize = {};
            let $col = $("<div class='cb-column autosizecolumn'><p></p></div>");
            let $row = $("<div class='row autosizecolumn'><div class='cb-cell'></div></div>");
            let $cell = $row.find(".cb-cell");
            let $colName = $col.find('p');
            
            $thead.append($col);
            $groups.append($cell);

            let marginWidth = Helpers.jQuery.getCssStyle($colName, "margin-left", true) + Helpers.jQuery.getCssStyle($colName, "margin-right", true);
            let paddingWidth = Helpers.jQuery.getCssStyle($cell, "padding-left", true) + Helpers.jQuery.getCssStyle($cell, "padding-right", true);

            for(var i in _columns.data.items) {         
                /*
                 * Beaucoup plus rapide, mais moins précis
                 * A voir si amélioration
                 */
//                let max = Helpers.String.getWidth(column.name, $colName) + marginWidth;
//                let maxValue = { length: 0, text: '' };
//                
//                _rows.data.items.forEach(row => {
//                    let value = row[column.id];
//                    let newMax = Math.max(maxValue.length, value.trim().length);
//                    if(newMax > maxValue.length) {
//                        maxValue.length = newMax;
//                        maxValue.text = value.trim();
//                    }
//                });
//                max = Math.max(max, Helpers.String.getWidth(maxValue.text, $cell));
                
                let column = _columns.data.items[i];
                let values = _rows.data.items.map(row => row[column.id]);
                let max = Helpers.String.getWidth(column.name, $colName) + marginWidth;
                
                values.forEach(value => max = Math.max(max, Helpers.String.getWidth(value, $cell)));
                
                _columns.autoSize[column.id] = max + paddingWidth;
            }
            $thead.find(".cb-column.autosizecolumn").remove();
            $groups.find(".row.autosizecolumn").remove();
        }
        
        if(settings.autoSizeColumns && _columns.autoSize === null) return;
        
        for(var i in _columns.colspans.items) {
            _columns.colspans.items[i].width = 0;
        }
        
        for(var i in _columns.data.items) {
            var idxCol = parseInt(i);
            var cellWidth = 200;
            var column = _columns.data.items[idxCol];
            
            if(settings.autoSizeColumns && column.width === "auto") {
                column.width = _columns.autoSize[column.id];
            }
            
            if (typeof column.width !== "undefined") cellWidth = column.width;
            
            if (typeof cellWidth === "string" && cellWidth.indexOf('%') > -1) {
                cellWidth = eval(cellWidth.replace(/\d+%/, _table.width * (parseInt(cellWidth.match(/(\d+)%/)[1]) / 100)));
            }
            
            _column.initializeColspan(column);
            
            if(_columns.colspans.columns[column.id]) {
                _columns.colspans.columns[column.id].forEach(colspan => {
                    if(colspan.column[column.id].last) colspan.width = nextLeftPos + cellWidth;
                });
            }

            column._Width = cellWidth;
            column._leftPos = totalWidth;
            nextLeftPos += cellWidth;
            totalWidth += cellWidth + 10;
        }
        
        for(var i in _columns.data.items) {
            let column = _columns.data.items[i];
            let cellWidth = column._Width;
            var cssCell = "width: " + cellWidth + "px; min-width: " + cellWidth + "px; max-width: " + cellWidth + "px; ";
            
            if(setHeads) {
                var textAlignColumn = column.header.justif === 'R' ? 'right' : (column.header.justif === 'C' ? 'center' : 'left');
                style.heads += gridTableCSS +".cb-column.cb-column-"+ column.id +" { " +
                        "text-align: "+ textAlignColumn +"; " +
                        "justify-content: "+ (textAlignColumn === "left" ? "start" : (textAlignColumn === "right" ? "end" : "center")) +"; " + 
                        "left: " + (column._leftPos - _table.currentScrollLeft) + "px !important; " +
                        cssCell +
                    " } ";
                style.heads += gridTableCSS +".col-resizing.cb-column-"+ column.id +" { " +
                        "left: " + (column._leftPos + cellWidth - _table.currentScrollLeft) + "px !important; " +
                    " } ";
            }
            if(setBody) {
                var textAlignCell   = column.justif === 'R' ? 'right' : (column.justif === 'C' ? 'center' : 'left');
                style.body += gridTableCSS + ".cb-cell-" + column.id + " { " +
                        "text-align: "+ textAlignCell +"; " +
                        "justify-content: "+ (textAlignCell === "left" ? "start" : (textAlignCell === "right" ? "end" : "center")) +"; " + 
                        "left: " + column._leftPos + "px !important; " +
                        cssCell +
                    " } ";
            
                let colspansColumn = _columns.colspans.columns[column.id];
                if(colspansColumn) {
                    colspansColumn.forEach(colspan => {
                        let filterCSS = colspan.filter ? colspan.filter : '';
                        if(colspan.column[column.id].first) {
                            let justif = '';
                            if(colspan.justif) justif = colspan.justif === 'R' ? "right" : (colspan.justif ===  'C' ? "center" : "left");
                            style.body += gridTableCSS + ".cb-row"+ filterCSS +" .cb-cell-" + column.id + " { " +
                                    ( colspan.justif ? "text-align: "+ justif +"; justify-content: "+ (justif === "left" ? "start" : (justif === "right" ? "end" : "center")) +"; " : '' )+ 
                                    "width: " + colspan.width + "px; min-width: " + colspan.width + "px; max-width: " + colspan.width + "px; " +
                                " } ";
                        }
                        else {
                            style.body += gridTableCSS + ".cb-row"+ filterCSS +" .cb-cell-" + column.id + " { width: 0px; min-width: 0px; max-width: 0px; padding: 0!important; margin: 0!important; } ";
                        }
                    });
                }
            }
        }

        style.body += gridTableCSS +".cb-group, "+ gridTableCSS +".cb-total, "+ gridTableCSS +".cb-row { width: "+ totalWidth +"px; }";

        if(setHeads) styleHeadsNode.innerHTML = style.heads;
        if(setBody) styleBodyNode.innerHTML = style.body;
    };

    /*
     * Définition des évènements du tableau
     */
    _table.setEvents = function() {
        $thead.off("mousedown sort selectAll selectionAll colClick");
        $tbody.off("rowSelection mousewheel scroll drop groupClick cellInput notEditable editable validate");
        $(document).off("CBTevents");

        // Si les lignes sont cliquable 
        if (settings.rowsCheckable) {
            $tbody.on('change.cellInput', '.cb-row > div > input[type=checkbox]:not([name^=row])', function () {
                var node = $(this).parent();
                var column = _columns.get(node);

                if(!column.checkable) {
                    return false;
                }

                _rows.update(node.parents('.cb-row'), column.id, $(this).is(':checked'));

                var items = _rows.data.filtered.filter(function (item) {
                    return item[column.id] === true;
                });

                propCheckHeader([column._index_column], items.length === _rows.data.filtered.length);
            });

            // Sélection globale
            $thead.on('change.selectAll', "[row-selection] > input", function (e) {
                let isChecked = $(this).is(':checked');
                _rows.select(isChecked);
            });

            // Au click d'une ligne, d'un groupe
            var fromRowClicked = false;
            $tbody.on("click.groupClick", ".cb-row, .cb-group", function (e) {

                if(settings.disableNodeRowsSelection) {
                    if(typeof $(e.target).parent().attr("row-selection") === "undefined") return false;
                }

                var node = $(e.target);
                var nodeRow = $(this);

                // Clique sur la ligne
                if (!node.is('input, button, span[class^="icon-"]')) {
                    fromRowClicked = true;
                    if (nodeRow.is('.cb-group')) {
                        var $input = nodeRow.find('> input[type="' + input_type + '"]').first();
                    } else {
                        var $input = nodeRow.find('> div:first-child > input');
                    }
                    $input.prop("checked", !$input.prop("checked")).change();
                }
                // Evènement sur la colonne ?
                else if (fromRowClicked === false) {
                    var nodeParent = node.parents(".cb-row > div");
                    var columnDef = _columns.get(nodeParent);

                    if (typeof columnDef !== "undefined" && typeof columnDef.click === "function") {
                        var data = _rows.getData(nodeRow);
                        var handle = {
                            target: node,
                            nodeRow: nodeRow,
                            event: e
                        };

                        columnDef.click(data, handle);
                    }
                }

                fromRowClicked = false;
            });

            // Au changement de valeur des checkbox des lignes
            $tbody.on('change.rowSelection', ".cb-group > input, .cb-row > div:first-child > input", function (e) {
                var isChecked = $(this).is(':checked');
                var node_group = $(this).parents('.cb-group').first();
                var node_row = $(this).parents('.cb-row').first();
                var _group = node_group.length > 0;
                var data;

                // Inputs des groupes
                if (_group) {
                    var grp_idx = node_group.data("index");
                    data = _groups.data.items[grp_idx];

                    _rows._setRowSelected('group', grp_idx);
                }
                // Input par ligne
                else if (node_row.length > 0) {
                    data = _rows.getNode(node_row.index());

                    _rows._setRowSelected('row', data[columnID]);
                }
            });
        }

        /*
         * Evènements du header
         */

        // Tri par colonne
        if (settings.sortable) {
            $thead.on("click.sort", "div", function (e) {
                var column = _columns.get($(this));
                
                if (typeof column === "undefined" || column.sortable === false) return;
                
                _rows.sort(column);
            });
        }
        
        if(settings.allowColumnResizing) {
            $table.on("mousedown", "div.col-resizing", function(e) {
                let $col = $thead.find(".cb-" + $(this).data("column"));
                col_moving = {
                    pos: e.clientX,
                    target: $col,
                    width: $col.width()
                };
            });
            
            $(document).on("mousemove.CBTevents mouseup.CBTevents", function(e) {
                if(col_moving !== false) {
                    var column = _columns.get(col_moving.target);

                    if(e.type === "mousemove") {
                        column.width = col_moving.width + ( e.clientX - col_moving.pos );
                        
                        // On bloque la taille à 30
                        if(column.width < 30) column.width = 30;
                        
                        _columns.update(column.id, column);
                    }
                    else {
                        col_moving = false;
                        
                        if(typeof onColumnResized === "function") {
                            onColumnResized(e, {column: column});
                        }
                    }
                }
            });
        }

        /*
         * Evènements du contenu
         */

        /* Evènements des cases avec onClick */
        $tbody.on("click.notEditable", ".cb-row > div:not(.editable)", function (e) {
            if (typeof e.isTrigger === "undefined") {
                var column = _columns.get($(this));
                var row_data = _rows.getData($(this).parent().index());

                if(typeof column !== "undefined" && typeof column.onClick === "function"
                    && typeof row_data !== "undefined"
                    && (typeof column.target === "undefined" || $(e.target).is(column.target))) 
                {
                    column.onClick(row_data[columnID], row_data);
                }
            }
        });

        /* Evènements des cases éditables */
        $tbody.on("dblclick.editable keyup.editable keydown.editable validate.editable", ".cb-row", function (e) {

            if(settings.editable === false) {
                e.preventDefault();
                return;
            }
            
            var node_cell = $(e.target).parents(".editable").length > 0 ? $(e.target).parent() : $(e.target);
            if(node_cell.is("input, select, textarea")) node_cell = node_cell.parent();
            var column = _columns.get(node_cell);
            var row_data = _rows.getData(node_cell.parent().index());

            if (typeof column === "undefined") {
                console.warn("Aucune colonne correspondante => IDX: " + node_cell.index());
                return;
            }

            var editor = getEditor(column, row_data, {index: node_cell.index(), node: node_cell});
            var $editor = $(editor.html);
            var args = {
                row: row_data,
                node: node_cell,
                parent_node: node_cell.parent(),
                column: column,
                rows: _rows.data.filtered
            };

            // Edition d'une cellule
            if (node_cell.hasClass("edit") === false && e.type === "dblclick" && column.editorAlwaysVisible === false) {
//                if(typeof getCurrentEditor() !== "undefined") {
//                    destroyCurrentEditor();
//                }

                node_cell.addClass("edit");

                if(editor.type !== "password") {
                    node_cell.append($editor);
                }
                if(editor.element === "input") {
                    node_cell.find("> input").select();
                }

                if(typeof onBeforeEditCell === "function") {
                    args.value = row_data[column.id];
                    onBeforeEditCell(args);
                }
            }
            // Annulation de l'édition de la cellule focus
            else if(e.type === "keydown" && column.editorAlwaysVisible === false && e.which === eWhichCode.esc) {
                e.preventDefault();
                e.stopImmediatePropagation();

//                destroyCurrentEditor();
                _rows.isLastElementUpdated = true;
                _rows.update(node_cell.parent(), column.id, row_data[column.id]);
            }
            // Validation de la cellule
            else if (e.type !== "keydown" && (e.type === "validate" || column.editorAlwaysVisible || e.which === eWhichCode.enter)) {
                var $input = node_cell.find("> input, > select");
                var cell_value = $input.val();
                var minValue = parseFloat($input.prop("min"));
                var maxValue = parseFloat($input.prop("max"));

                var float_val;
                if (isNaN(parseFloat(cell_value)) === false) {
                    float_val = parseFloat(cell_value);
                }

                if (isNaN(minValue) === false && float_val < minValue) {
                    cell_value = minValue;
                }
                else if (isNaN(maxValue) === false && float_val > maxValue) {
                    cell_value = maxValue;
                }

                args.value = cell_value;
                if (typeof onBeforeCellChange === "function") {
                    var changed_value = onBeforeCellChange(args);

                    if (typeof changed_value !== "undefined") {
                        $input.val(changed_value);
                        cell_value = changed_value;
                    }
                }
                args.value = cell_value;
                _rows.isLastElementUpdated = true;
                _rows.update(
                    node_cell.parent(), 
                    column.id, 
                    cell_value, 
                    null, 
                    column.editorAlwaysVisible === false
                );
//                destroyCurrentEditor();

                onEditCell.call(args);
            }
        });

        $tbody.on("blur.validate change.validate", ".cb-row > div.editable > input, .cb-row > div.editable > select", function (e) {
            // Utilisation du tryCatch
            // A l'appui sur "Entrée", l'input trigger est supprimé par "_rows.print" ce qui retourne une erreur avec un évènement appelé sur un élément non présent dans le DOM
            try {
                if(_rows.isLastElementUpdated === false) $(this).parent().trigger("validate");
                _rows.isLastElementUpdated = false;
            }
            catch(e) {
                // Do nothing
            }
        });

        // Au changement de valeur de la checkbox de la colonne
        $thead.on('change.selectionAll', "> div > input", function (e) {

            if($(this).parent().is("#selectAllCB")) {
                return false;
            }

            var column = _columns.get($(this).parent());
            if (column.checkable) {
                var isChecked = $(this).is(':checked');
                var nodesRows = $groups.find('> .row');
                var nodesCols = nodesRows.find('> div:nth(' + column._index_column + ')');
                var paramColumn = {
                    param: column,
                    nodes: nodesCols
                };

                _rows.updateSeveral(column.id, isChecked);

                if (typeof column.onChangeCheckboxHeader === "function") {
                    column.onChangeCheckboxHeader(isChecked, paramColumn, e);
                }
            }
        });
    
        $thead.on('click.colClick', "> div", function (e) {
            var node = $(this);
            var column = _columns.get(node);

            if(typeof column !== "undefined" && typeof column.header.click === "function") {
                var nodeRows = $groups.find(".cb-row > div:nth-child("+ ( column._index_column + 1 ) +")");
                var args = {
                    setColumnAttribute: function(attr, value) {
                        column[attr] = value;
                        _columns.data.items[column._index_column] = column;
                    }
                };
                
                column.header.click(node, nodeRows, column, args);
            }
        });

        // Au clique sur un groupe
        $tbody.off('drop').on('click.drop', '.cb-group > span[class^="icon-"]', function () {                       
            var $group = $(this).parent();
            var _group_index = $group.data("index");
            var _group = _rows.getNode(_group_index, "group");
            var handle = {
                drop: function () {
                    _groups.drop(_group_index);
                },
                collapse: function () {
                    _groups.collapse(_group_index);
                },
                preventFromDrop: function () {
                    preventFromDrop = true;
                },
                preventFromCollapse: function () {
                    preventFromCollapse = true;
                }
            };

            if (!_group.dropped) {
                onGroupDrop.call(_group, handle);
                
                if (preventFromDrop === false) handle.drop();
            }
            else {
                onGroupCollapse.call(_group, handle);
                
                if (preventFromCollapse === false) handle.collapse();
            }

            preventFromDrop = false;
            preventFromCollapse = false;
        });

        var scrollFromMouseWheel = false;
        $tbody.bind("mousewheel", function(e) {
            if($(e.target).is("input, select")) return;
            scrollFromMouseWheel = true;

            var delta = e.originalEvent.wheelDeltaY < 0 ? 1 : -1;
            var scrollTop = $tbody.scrollTop();

            if(scrollTop % _table.row_height !== 0) {
                scrollTop = scrollTop + (_table.row_height - (scrollTop % _table.row_height));
            }

            scrollTop += delta * _table.row_height;
            $tbody.scrollTop(scrollTop);
            _table.currentScrollTop = $tbody.scrollTop();
            _rows.print();

            e.preventDefault();
            return false;
        });

        $tbody.on("scroll", function (e) {
            if(scrollFromMouseWheel || col_moving !== false) {
                scrollFromMouseWheel = false;
                e.preventDefault();
                return false;
            }
            
            var scrollTop = $tbody.scrollTop();
            var scrollLeft = $tbody.scrollLeft();
            
            if(Math.abs(scrollTop - _table.currentScrollTop) > 0) {
                _rows.print();
                clearTimeout(_table.onScrollEnding);
                _table.onScrollEnding = setTimeout(function() {
                    _rows.print();
                }, 50);
            }
            else if(settings.fitColumnLengthToBody === false && Math.abs(scrollLeft - _table.currentScrollLeft) > 0) {
                _table.currentScrollLeft = scrollLeft;                
                _table.setStyle("heads");
            }

            _table.currentScrollTop = scrollTop;
            return false;
        });
    }







    /*
     *
     * FONCTIONS DES COLONNES
     *
     */






    
    _columns.print = function() {
        $thead.empty();
        $tfoot.empty();
        
        _groups.data.selected = [];
        _columns.data.ordered = [];

        // Autorisation sélection globale
        if (settings.rowsCheckable) {
            $thead.append('<div row-selection'+ (settings.globalSelection && settings.multipleSelection ? ' id="selectAllCB"><input type="checkbox"/>' : '>') +'</div>');
        }

        if (settings.rowsCheckable) {
            $tfoot.append($('<div></div>'));
        } else {
            $table.attr("no-hover", true);
        }
        
        var $thead_sub = $table.find(".thead-sub");
        if(settings.enableSubHeads && $thead_sub.length === 0) {
            $thead_sub = $('<div class="thead-sub"></div>');
            $thead.after($thead_sub);
        }
        
        for (var i in settings.columns) {
            var idxCol = parseInt(i);
            var column = settings.columns[idxCol];
            var column_node = document.createElement("div");
            
            if(typeof column.header !== "undefined") column.header = $.extend({}, defaultColumn.header, column.header);

            column = $.extend({}, defaultColumn, column);
            
            var checkboxHeader = '';
            if (column.checkable) {
                var nameCB = typeof column.checkboxHeaderName !== "undefined" ? column.checkboxHeaderName : column.id;
                checkboxHeader = '<input type="checkbox" name="' + nameCB + '" />&nbsp;';
            }
            
            if(column.editor !== false && column.editorAlwaysVisible === false) {
                column_node.classList.add('editable');
            }
            
            column_node.classList.add("cb-column", "cb-column-" + column.id);
            column_node.innerHTML = checkboxHeader +
                    '<p class="'+ column.header.class +'">' + 
                        column.name.replace(/ /g, '&nbsp;').replace(/-/g, '&#8209;') + 
                        column.header.content +
                    '</p>';
            if(column.header.attribute !== '') column_node.setAttributes(column.header.attribute);
            
            $thead.append(column_node);
            if(settings.allowColumnResizing) $table.append('<div class="col-resizing cb-column-' + column.id +'" data-column="column-' + column.id +'"></div>');
            
            if(typeof column.subHeadHTML !== "undefined") {
                var $subHead = $(column.subHeadHTML);
                $subHead.addClass("cb-column cb-column-" + column.id);
                $thead_sub.append($subHead);
            }

            if (settings.rowsCheckable === false) $tfoot.append($('<div class="cb-cell cb-cell-'+ column.id +'" data-column="' + column.id + '"></div>'));

            _columns.data.ordered.push(column);
            _columns.data.items.push(column);
        }
        
        _table.setStyle();
    };

    // Récupère une colonne par son index
    _columns.get = function(col) {
        let defColumn;
        let idx;
        
        if(col instanceof jQuery) {
            idx = col.index() - (col.parents(".cb-row").length > 0 ? rowsColCheckbox : headerColCheckbox);
        }
        else if(isNaN(col)) {
            defColumn = _columns.data.items.find(column => column.id === col);
        }
        else {
            idx = col;
        }

        if (typeof idx !== "undefined" && idx >= 0) {
            defColumn = _columns.data.items[idx];
            defColumn._index_column = parseInt(idx);
        }

        return defColumn;
    };

    // Retourne les colonnes
    _columns.getAll = function() {
        return _columns.data.items;
    };
    
    _columns.set = function(columns) {
        settings.columns = columns;
        _columns.data.items = [];

        _columns.print();
    };

    _columns.add = function(column) {
        settings.columns.push(column);
        
        _columns.print();
    };
    
    _columns.remove = function(id) {
        settings.columns = settings.columns.filter(function(column) {
            return column.id !== id;
        });
        
        _columns.print();
    };

    _columns.update = function(id, column, update_view = true) {
        if(typeof id === "undefined") { console.error("Identifiant de la colonne manquant"); return; }
        if(typeof column === "undefined") { console.error("Nouvelles données pour la colonne manquantes"); return; }
                
        var def_column = _columns.get(id);
        
        def_column = $.extend({}, def_column, column);
        settings.columns[def_column._index_column] = def_column;
        _columns.data.items[def_column._index_column] = def_column;

        if(update_view) _table.setStyle();
    };
    
    _column.initializeColspan = function(columnDef) {
        if(typeof columnDef.colspan !== "undefined") {
            if(typeof columnDef.colspan === "string") columnDef.colspan = { to: columnDef.colspan };
            if(typeof columnDef.items === "undefined") {
                let colspan = columnDef.colspan;
                let indexStart = _column.getIndex(columnDef.id, false);
                let indexEnd = _column.getIndex(colspan.to, false);
                let items = _columns.data.items.filter((col, idx) => idx >= indexStart && idx <= indexEnd);
                
                colspan.key = columnDef.id +'->'+ colspan.to;
                colspan.items = items.map(col => col.id);
                colspan.column = Object.fromEntries(items.map((col, idx) => [col.id, { first: idx === indexStart, last: idx === items.length - 1, hidden: idx > indexStart }]));
                
                _columns.colspans.items[colspan.key] = colspan;
                for(var id in colspan.column) {
                    if(typeof _columns.colspans.columns[id] === "undefined") _columns.colspans.columns[id] = [];
                    _columns.colspans.columns[id].push(colspan);
                }
            }
        }
    };

    /*
     * Retourne l'index de la colonne par son identifiant
     * @param {int} id  ID de la colonne
     * @return {int}    Retourne l'index de la colonne. Retourne -1 en cas de colonne inconnue
     */
    _column.getIndex = function(id, countCheckboxCol = true) {
        var index = _columns.data.items.map(col => col.id).indexOf(id);
        return index > -1 ? parseInt(index) + (countCheckboxCol ? headerColCheckbox : 0) : -1;
    }

    /*
     * Défini l'état du checkbox du header de la colonne
     * @param {array} cols        Liste des colonnes (IDX ou IDS des colonnes)
     * @param {string} propValue  Valeur à définir
     */
    function propCheckHeader(cols, propValue) {
        handleCheckHeader('change', propValue, '', cols);
    }
    /*
     * Trigger le checkbox du header de la colonne
     * @param {array} cols Liste des colonnes (IDX ou IDS des colonnes)
     * @param {string} evt Evènemnent à trigger
     */
    function triggerCheckHeader(cols, evt) {
        handleCheckHeader('trigger', '', evt, cols);
    }
    /*
     * Défini l'état du checkbox et trigger le checkbox du header de la colonne
     * @param {array}  cols Liste des colonnes (IDX ou IDS des colonnes)
     * @param {string} evt Evènemnent à trigger
     * @param {string} propValue  Valeur à définir
     */
    function changeAndTriggerCheckHeader(cols, propValue, evt = 'change') {
        handleCheckHeader('both', propValue, evt, cols);
    }

    function handleCheckHeader(todo, propValue, evt, cols) {
        var columnsIdx = [];
        var error = false;

        for (var idx in cols) {
            var col = cols[idx];
            var errorOccurred = false;
            var idx;
            var verifNegValue = false;

            if (isNaN(col) === false) {
                idx = col;
            } else {
                verifNegValue = true;
                idx = _column.getIndex(col);
            }

            var column = _columns.get(idx);

            if (idx > -1 && typeof column !== "undefined" && column.checkable === false) {
                errorOccurred = 'CheckHeader: La colonne n\'est pas sélectionnable.';
            }
            // Si l'index retourné est supérieur au nombre de colonnes
            else if ((parseInt(col) - headerColCheckbox) > _columns.data.items.length) {
                errorOccurred = 'CheckHeader: Le numéro de colonne est supérieur au nombre de colonnes définies.';
            }
            // Si on ne trouve pas la colonne et qu'on a renseigné un ID
            else if (verifNegValue && idx === -1) {
                errorOccurred = 'CheckHeader: Aucune colonne trouvée avec un l\'ID << ' + col + ' >>.';
            }
            // Si on a renseigné un index < 0
            else if (idx < 0) {
                errorOccurred = 'CheckHeader: Renseigner un numéro de colonne positif.';
            }

            if (errorOccurred) {
                console.warn(errorOccurred);
                error = true;
            }

            columnsIdx.push(idx);
        }
        ;

        if (error) {
            return;
        }

        var $inputs = $thead.find('> div:nth(' + columnsIdx.join('), > div:nth(') + ')').find('> input');
        var setPropChange = todo === 'change' || todo === 'both';
        var triggerInput = todo === 'trigger' || todo === 'both';

        if (setPropChange) {
            $inputs.prop('checked', propValue);
        }
        if (triggerInput) {
            $inputs.trigger(evt);
        }
    }





    /*
     *
     * FONCTIONS DES DONNEES
     *
     */





    _table.init = function() {
        if (!$.isEmptyObject(options)) {

            // Reparamétrage du tableau en fonction des options saisies
            settings = $.extend({}, defaults, options);
            
            columnID = settings.columnUniqueID;
            _rows.data.items = settings.rows;
            _table.row_height = settings.rowHeight;

            if(settings.multipleSelection) {
                input_type = "checkbox";
            }

            $table.addClass("gridTable gridTable-" + ID);
            $table.html(
                '<div class="thead"></div>'+
                '<div class="tbody">'+
                    '<div id="groups"></div>'+
                '</div>'+
                '<div class="tfoot"></div>'
            );
            $thead = $table.find('.thead');
            $tbody = $table.find('.tbody');
            $groups = $table.find('#groups');
            $tfoot = $table.find('.tfoot');

            if (typeof settings.columns === "undefined") {
                console.warn('Aucune colonne sp&eacute;cifi&eacute;e !');
                return;
            }

            // Si les lignes ne sont pas sélectionnables, on désactive la sélecion globale
            if (settings.rowsCheckable === false || settings.multipleSelection === false) {
                settings.globalSelection = false;
            }

            headerColCheckbox = settings.hideSelectableColumn || ( settings.globalSelection === false && settings.multipleSelection ) ? 0 : 1;
            rowsColCheckbox = settings.hideSelectableColumn || settings.rowsCheckable === false ? 0 : 1;
            
            $table.addClass(settings.theme);
        
            if(settings.fullTheme === true) $table.addClass("theme-full");
            
            _table.setEvents();
            _columns.print();
            _table.resize();
            _rows.set();

            if (settings.hideHeaders) {
                $thead.hide();
            }
            if (settings.hideFooter) {
                $tfoot.hide();
            }

            if (settings.selectAll && settings.rowsCheckable && settings.globalSelection) {
                $thead.find('#selectAllCB > input').prop('checked', true).trigger('change');
            }

        } else {

            console.warn('D&eacute;finir les options');
            return;

        }
    };

    _rows.getNode = function(row, prefix = '') {
        if(prefix === '') {
            row = parseInt(row);
            if(_groups.printed) {
                return _rows.data.print[row + _table.range.start];
            }
            else {
                var _rowIndex = Object.values(_rows.data.idxs).findIndex(idx => parseInt(idx) === ( row + _table.range.start));
                return _rows.data.rowById[Object.keys(_rows.data.idxs)[_rowIndex]];
            }
        }
        else if(prefix === "group") {
            let group = _groups.data.items;
            let index_str = '';
            row = row.toString().split('-');
            
            row.forEach((index, i) => {
                if(i > 0) group = group.rows;
                index_str += index;
                group = group.find(grp => grp._parent_index.toString() === index_str);
                index_str += '-';
            });
            return group;
        }
        return columnDef.colspan;
    };

    /*
     * On définie les données du tableau
     */
    _rows.set = function(rows) {
        
        if (typeof rows === "undefined") rows = _rows.data.items;

        if (rows instanceof Array === false) {
            console.warn("La liste des valeurs n'est pas un tableau");
        }

        _rows.data.items = rows;
        _rows.data.filtered = rows;
        _rows.data.selected = [];
        _groups.data.selected = [];        
        _groups.printed = false;
        
        _rows.setCache();

        $groups.height(_rows.data.items.length * _table.row_height);

        if (rows.length > 0 && settings.sortBy !== '') {
            var params = settings.sortBy.split(' ');
            var col = params[0];
            var sens = params.length > 1 ? params[1] : "ASC";
            var column_rows = rows.map(function (row, idx) {
                return {index: idx, value: row[col]};
            });

            column_rows = Helpers.Array.sort(column_rows, "value", sens);
            rows = column_rows.map(col_row => rows[col_row.index]);
        }
        
            
        if(settings.autoSizeColumns) {
            _columns.data.items.forEach(column => column.width = "auto");
            _table.setStyle("autoSizeColumns");
        }
        
        _rows.print();
    };

    _rows.print = function() {
        $groups.empty();

        if (_rows.data.items.length === 0) {
            _rows.clear();
            return;
        }

        // On affiche les 5 précédentes / prochaines lignes
        _table.range.start = parseInt(_table.currentScrollTop / _table.row_height) - 5;
        _table.range.end = parseInt((_table.currentScrollTop + $tbody.height()) / _table.row_height) + 5;

        if(_table.range.start < 0) {
            _table.range.start = 0;
        }

        var rowsFitContent = [];
        if(_groups.printed) {
            rowsFitContent = _rows.data.print.filter((item, idx) => idx >= _table.range.start && idx <= _table.range.end);
        }
        else {
            rowsFitContent = _rows.data.filtered.filter((item, idx) => idx >= _table.range.start && idx <= _table.range.end);
        }

        rowsFitContent.forEach((row, index) => $groups.append(_rows.setNode(index, row)));
        
        if(typeof settings.onRowsPrint === "function") {
            settings.onRowsPrint(_rows.data.items, _rows.getNodes());
        }
        
        // On affecte le précédent scrollLeft
        $tbody.scrollLeft(_table.currentScrollLeft);
        
        _table.printTotals();
    };
    
    _rows.sort = function(col) {
        let orderBy;
        let idCol;
        let column;
        
        if(typeof col === "string") {
            col = col.split(' ');
            orderBy = col.length === 1 ? "ASC" : col[1].trim();
            column = _columns.get(col[0].trim());
        }
        else {
            column = col;
            orderBy = typeof column._order_by === "undefined" || column._order_by === "DESC" ? "ASC" : "DESC";
        }
            
        if(typeof column === "undefined") {
            idCol = col[0];
        }
        else {
            idCol = column.id;
        }

        if(_groups.printed) {
            for(var i in _groups.data.items) {
                var _group = _groups.data.items[i];
                var total_row;

                if(_groups.printTotals) total_row = _group.rows.pop();

                var sort_data = _group.rows.map(function (row) {
                    return {uniqueId: row[columnID], value: row[idCol]};
                });
                sort_data = Helpers.Array.sort(sort_data, "value", orderBy);

                _group.rows = sort_data.map(row => _rows.data.rowById[row.uniqueId]);

                if(_groups.printTotals) _group.rows.push(total_row);
            }
            _groups.setRows();
        }
        else {
            var sort_data = _rows.data.filtered.map(function (row) {
                return {uniqueId: row[columnID], value: formatValueForSort(column, row[idCol])};
            });
            sort_data = Helpers.Array.sort(sort_data, "value", orderBy);
            _rows.data.filtered = sort_data.map(row => _rows.data.rowById[row.uniqueId]);
            _rows.setIndexation();
        }

        _rows.print();
        if(column) column._order_by = orderBy;
    };
    
    _rows.setCache = function() {
        _rows.setIndexation();
        _rows.data.rowById = Object.fromEntries(_rows.data.filtered.map(row => [row[columnID], row]));
    };
    
    _rows.setIndexation = function() {
        _rows.data.idxs = Object.fromEntries(
            _rows.data.filtered.map(function(row, idx) {
                if(typeof row[columnID] === "undefined") row[columnID] = idx;
                return [row[columnID], idx];
            })
        );
    };

    /*
     * Définit le HTML des lignes du tableau
     */
    _rows.setNode = function(index, row) {
        var uniqueId;
        var node_row = document.createElement("div");

        index = parseInt(index) + _table.range.start;
        
        let enableSelection = false;
        if(settings.rowsCheckable) enableSelection = typeof settings.rowsCheckable === "function" ? settings.rowsCheckable(index, null, row) : true;

        if(row._group === true) {
            uniqueId = row._index;
            var indexGroup = uniqueId;
            var group_name = row.value;
            var selectedGroupRows = row.uniqueIds.filter(uniqueId => _rows.data.selected.includes(uniqueId));

            if(typeof _groups.formatter === "function") {
                group_name = _groups.formatter(row._index - 1, row.value, {rows: row.rows, count: row.count, selected: selectedGroupRows});
            }

            node_row.classListe.add("cb-group");
            node_row.dataset.index = row._parent_index;
            node_row.innerHTML = '<span class="icon-interface-plus"></span> ' + group_name;
            node_row.firstElementChild.style.marginLeft = ((row._parent_index.toString().split('-').length - 1) * 30) + 'px';

            // Hauteur du groupe en fonction du groupe précédent (lignes affichées ou non)
            // if(indexGroup > 0) {
                // var previousGroup = _groups.data.items[indexGroup - 1];

                // if(!isNaN(previousGroup._indexPrint)) {
                    // indexGroup = previousGroup._indexPrint + 1;
                // }

                // if(previousGroup.dropped) {
                    // indexGroup += previousGroup.rows.length;
                // }
            // }

            row._indexPrint = indexGroup;
            node_row.style.top = ( indexGroup * _table.row_height ) + "px";
            node_row.firstChild.classList.add("icon-interface-" + ( row.dropped ? "minus" : "plus" ));

            uniqueId = "_group" + uniqueId;
        }
        else if(row._total === true) {
            uniqueId = row._group_index;

            node_row.className = "cb-total";

            for(var i in row) {
                if(i !== "_group_index" && i !== "_total") {
                    var node_cell = document.createElement("div");

                    node_cell.classList.add("cb-cell", "cb-cell-" + row[i].column);
                    node_cell.innerHTML = row[i].value;

                    node_row.appendChild(node_cell);
                }
            }

            uniqueId = "_total" + uniqueId;
        }
        else {
            uniqueId = row[columnID];

            var node_checkbox   = document.createElement("div");
            var node_input      = document.createElement("input");
            var metadata        = settings.metadata(uniqueId, row);

            if(typeof metadata !== "undefined") {
                if(typeof metadata.cssClasses !== "undefined") {
                    let classes = metadata.cssClasses;
                    if(typeof classes === "string") classes = classes.split(' ');

                    classes.forEach(className => node_row.classList.add(className));
                }
            }
            
            node_row.classList.add("cb-row", index % 2 === 0 ? "odd" : "even");
            if(_groups.printed) node_row.dataset.indexGroup = row._parent_group;

            if(settings.rowsCheckable) {
                node_input.type = input_type;
                node_input.name = "row_selection" + (!settings.multipleSelection ? '' : uniqueId);
                
                node_checkbox.setAttribute("row-selection",'');
                if(enableSelection) node_checkbox.appendChild(node_input);
                
                if(settings.hideSelectableColumn) {
                    node_checkbox.style.maxWidth = 0;
                    node_checkbox.style.padding = 0;
                    node_checkbox.style.opacity = 0;
                }
                
                node_row.appendChild(node_checkbox);
            }

            if(_rows.data.selected.includes(uniqueId)) {
                node_row.classList.add("selected");
                node_input.checked = true;
            }

            for (var i in _columns.data.ordered) {
                var idxCol = parseInt(i);
                var column = _columns.data.ordered[idxCol];
                var value = typeof row[column.id] === "undefined" ? '' : row[column.id];
                var node_cell = document.createElement("div");
                node_cell.className = "cb-cell cb-cell-" + column.id + (column.class ? ' ' + column.class : '');
                node_cell.innerHTML = _rows.formatCell(uniqueId, value, column, row, $(node_row));

                if(column.editor !== false) {
                    node_cell.classList.add("editable");

                    if(column.editorAlwaysVisible) node_cell.classList.add("alwaysVisible");
                }
                if(column.checkable) {
                    var node_row_input = document.createElement("input");                    
                    node_row_input.type = "checkbox";
                    node_row_input.name = "input_" + idxCol + uniqueId;
                    node_row_input.setAttribute("checked", value);
                    node_cell.prepend(node_row_input);
                    node_cell.prepend(node_row_input);
                    node_cell.prepend(node_row_input);
                    node_cell.prepend(node_row_input);
                    node_cell.prepend(node_row_input);
                    node_cell.prepend(node_row_input);
                }

                node_row.appendChild(node_cell);
            }
        }

        if(enableSelection === false) node_row.classList.add("not-selectable");

        if(typeof uniqueId === "undefined") {
            console.error("Une valeur unique n'a pas été définie");
            return;
        }
        
        node_row.dataset.id = uniqueId;
        node_row.style.top = (index * _table.row_height) + 'px';

        return node_row;
    };

    _rows.formatCell = function(index, value, column, row, node) {
        var editor = getEditor(column, row, {index: index, node: node});
        var texte = column.formatter(index, value, row, column, node);
        if(editor !== false && editor.visible) {
            if(editor.permanent || editor.type === "password") {
                texte = editor.html;
            }
            else {
                texte = editor.value;
            }
        }

        return texte;
    };

    /*
     * Retourne l'élément jquery des lignes du tableau
     * @return $rows nodes
     */
    _rows.getNodes = function(idxs = null, comparator = '') {
        var nodes = $groups.find('> .cb-row');

        if (nodes.length === 0 || idxs === null)
            return nodes;

        if (Array.isArray(idxs) && idxs.length > 0) {
            var nodesIdxs = [];

            nodes.each(function (index) {
                if ($.inArray(index, idxs) !== -1) {
                    nodesIdxs.push(':eq(' + index + ')');
                }
            });

            return $groups.find('> .cb-row' + (comparator === '!=' ? ':not(' + nodesIdxs.join(',') + ')' : nodesIdxs.join(', > .cb-row')));
        } 
        else if (typeof idxs === "function") {
            var nodesIdxs = [];

            $.each(_rows.data.filtered, function (index, item) {
                if (idxs(index, item)) {
                    nodesIdxs.push(':eq(' + index + ')');
                }
            });

            return $groups.find('> .cb-row' + nodesIdxs.join(', > .cb-row'));
        } 
        else if (isNaN(idxs) === false) {
            return typeof nodes[idxs] === "undefined" ? false : $(nodes[idxs]);
        } 
        else {
            return nodes;
        }
    };

    /*
     * Sélectionne une liste d'item
     * @param {type} items
     */
    _rows.select = function(items, order_rows = null)
    {
        handlerItemsSelection(true, items, order_rows);
    };

    /*
     * Désélectionne une liste d'item
     * @param {type} items
     */
    _rows.deselect = function(items, order_rows = null) {
        handlerItemsSelection(false, items, order_rows);
    };

    function handlerItemsSelection(selected, selector, order_rows) {
        if (typeof selector === "undefined") {
            console.warn("Aucun élément renseigné pour la sélection");
            return;
        }
        
        var uniqueIds = [];
        if(typeof selector === "boolean") {
            uniqueIds.push(selector);
        }
        else if (Array.isArray(selector)) {
            uniqueIds = Object.keys(_rows.data.idxs).filter(id => selector.includes(parseInt(id)));
        }
        else if (isNaN(selector) === false) {
            var item = Object.keys(_rows.data.idxs).find(id => parseInt(id) === parseInt(selector));
            if(typeof item !== "undefined") uniqueIds = [item[columnID]];
        }
        else if(typeof selector === "function") {
            uniqueIds = _rows.data.filtered.filter((item, idx) => selector(idx, item)).map(item => item[columnID]);
        }
        
        _rows._setRowSelected('', false, true);
        for(var i in uniqueIds) {
            if( ! isNaN(parseInt(uniqueIds))) uniqueIds[i] = parseInt(uniqueIds[i]);
            _rows._setRowSelected("row." + ( selected ? "add" : "remove" ), uniqueIds[i], true);
        }

        _rows.print();
        // handleSelectedRows("add", uniqueIds);

        // orderRowsBySelectionState(order_rows);
        // for (var id in _rows.data.idxs)
        // {
        //     var idx_row = _rows.data.idxs[id];

        //     if (_rows.data.selected.includes(parseInt(id))) {
        //         $tbody.find('.row:nth(' + idx_row + ')').addClass('selected');
        //         if (settings.rowsCheckable) {
        //             $tbody.find('.row:nth(' + idx_row + ') > div:first-child > input').prop('checked', selected).trigger("change");
        //         }
        //     }
        // }
    }

    _rows._setRowSelected = function(target, uniqueId, preventPrint = false) {
        if ( ! settings.multipleSelection || uniqueId === false) {
            _rows.data.selected = [];
            _groups.data.selected = [];
        }

        if (uniqueId === true) {
            _rows.data.selected = Object.keys(_rows.data.idxs).map(id => parseInt(id));
            if(_groups.printed) {
                _groups.data.selected = Object.keys(_rows.data.group_id).map(id => parseInt(id));
            }
        }
        else if(uniqueId !== false) {
            target = target.split('.');

            var action = typeof target[1] === "undefined" ? null : target[1];
            var targetArray = target[0] === "row" ? _rows : _groups;
            var isRowSelected = targetArray.data.selected.includes(uniqueId);

            if(action === "remove" || (action === null && isRowSelected)) {
                targetArray.data.selected = targetArray.data.selected.filter(id => id !== parseInt(uniqueId));
                isRowSelected = false;
            }
            else if(!isRowSelected) {
                targetArray.data.selected.push(uniqueId);
                isRowSelected = true;
            }
            
            if(typeof settings.onSelectedRow === "function") {
                settings.onSelectedRow(_rows.getNode(uniqueId), {selected: isRowSelected, _group: target[0] === "group", data: _rows.getById(uniqueId)});
            }
        }

        if(!preventPrint) _rows.print();
        
        if (typeof settings.onSelectedRowsCountChange === "function") {
            settings.onSelectedRowsCountChange(_rows.data.selected, _rows.data.filtered, _rows.data.selected.length === _rows.data.filtered.length);
        }
    };

    /*
     * On récupère les lignes du tableau
     */
    _rows.getSeveral = function(cols = [], getter = null) {
        return handleGetItems(null, cols, getter);
    };

    _rows.getFilteredItems = function(cols = [], getter = null) {
        return handleGetItems(null, cols, getter, true);
    };
    
    _rows.getFilteredSelectedItems = function(cols = [], getter = null) {
        return handleGetItems(true, cols, getter, true);
    };

    /*
     * On récupère les lignes du tableau par leur index
     */
    _rows.getByIdx = function(idxs = [], cols = []) {
        var allItems = _rows.getSeveral(cols);
        var items = [];

        if( ! (idxs instanceof Array)) idxs = [idxs];

        for (var i in allItems) {
            if (idxs.includes(parseInt(i))) {
                items.push(allItems[i]);
            }
        }

        return items;
    };

    /*
     * On récupère les lignes du tableau par leur identifiant
     */
    _rows.getById = function(id, cols = []) {
        if( ! Array.isArray(id)) id = [id];
        let items = handleGetItems(null, cols, (index, item) => id.includes(item[columnID]));
        if(id.length > 1) return items;
        return items[0];
    };
    
    _rows.getFilteredById = function(id, cols = []) {
        if( ! Array.isArray(id)) id = [id];
        let items = handleGetItems(null, cols, (index, item) => id.includes(item[columnID]), true);
        if(id.length > 1) return items;
        return items[0];
    };

    /*
     * On récupère les lignes sélectionnées du tableau
     */
    _rows.getSelectedIds = function() {
        return _rows.data.selected;
    };

    /*
     * On récupère les ids non sélectionnés du tableau
     */
    _rows.getUnselectedIds = function() {
        var ids = [];

        if (_rows.data.selected.length < _rows.data.items.length) {
            for (var i in _rows.data.filtered) {
                var id_row = _rows.data.filtered[i][columnID];
                if (_rows.data.selected.includes(id_row) === false) {
                    ids.push(id_row);
                }
            }
        }
        return ids;
    };
    
    _rows.getFilteredSelectedIds = function(cols = [], getter = null) {
        let idsFiltered = _rows.data.filtered.map(row => row[columnID]);
        return _rows.data.selected.filter(id => idsFiltered.includes(id));
    };
    
    /*
     * On récupère les lignes sélectionnées du tableau
     */
    _rows.getSelectedItems = function(cols = [], getter = null) {
        return handleGetItems(true, cols, getter);
    };

    /*
     * On récupère les lignes non sélectionnées du tableau
     */
    _rows.getUnselectedItems = function(cols = [], getter = null) {
        return handleGetItems(false, cols, getter);
    };

    /*
     * Gère la récupération des données du tableau
     */
    function handleGetItems(selected, cols, getter, getFilteredOnly = false) {

        // Si aucune colonne à récupérer n'est spécifiée
        if (typeof cols === "function") {
            getter = cols;
            cols = [];
        }

        var data;
        var all_idxs_rows = {};
        var all_filter_rows = {};
        var selectedArr = getFilteredOnly ? _rows.getFilteredSelectedIds() : _rows.getSelectedIds();

        var _rows_to_return = getFilteredOnly ? _rows.data.filtered : _rows.data.items;
        all_idxs_rows[0] = Object.keys(_rows_to_return);
        all_filter_rows[0] = _rows_to_return;

        var search_groups = selected ? _groups.data.selected : function (row, idx) {
            return _groups.data.selected.includes(idx) === false;
        };
        var search_rows = selected ? selectedArr : row => selectedArr.includes(row[columnID]) === false;
        var list_groups = selected === null ? {idxs: Object.keys(_groups), filter: _groups} : search("groups", search_groups, "", true);
        var list_rows = selected === null ? {idxs: all_idxs_rows, filter: all_filter_rows} : search("rows", search_rows, "", true);

        // On récupère toutes les données
        if (selected === null && cols.length === 0 && typeof getter !== "function") {
            data = {groups: list_groups.filter, rows: list_rows.filter[0]};
            return settings.groups ? data : data.rows;
        }

        data = {
            groups: [],
            rows: []
        };

        // On regarde les groupes sélectionnés
        if (selected !== null || settings.rowsCheckable) {
            for (var i in list_groups.filter) {
                var item = list_groups.filter[i];
                var retour = [];

                if (typeof cols === "string") {
                    retour.push(item[cols]);
                } else if (cols instanceof Array && cols.length > 0) {
                    if (cols.length === 1) {
                        retour.push(item[cols[0]]);
                    } else {
                        retour = {};
                        $.each(cols, function (index, col) {
                            retour[col] = item[col];
                        });
                    }
                } else {
                    retour = item;
                }

                data.groups.push(retour);
            }
        }

        for (var key in list_rows.filter) {
            var items = list_rows.filter[key];
            for (var i in items) {
                var item = items[i];
                var retour = [];

                if (typeof cols === "string") {
                    retour = item[cols];
                } else if (cols instanceof Array && cols.length > 0) {
                    if (cols.length === 1) {
                        retour.push(item[cols[0]]);
                    } else {
                        retour = {};
                        $.each(cols, function (index, col) {
                            retour[col] = item[col];
                        });
                    }
                } else {
                    retour = item;
                }

                if (getter === null || (typeof getter === "function" && getter(list_rows.idxs[key][i], item))) {
                    data.rows.push(retour);
                }
            }
        }

        // Groupes ? On retourne toutes les informations
        if (settings.groups || selected === null) {
            return settings.groups === false ? data.rows : data;
        }
        // On retourne un seul item si la sélection multiple est désactivée
        else if (settings.hideSelectableColumn && selected && settings.rowsCheckable) {
            return data.rows[0];
        }
        // On retourne les items
        else {
            return data.rows;
        }
    };

    /*
     * Ajoute un item au tableau
     */
    _rows.add = function(row) {
        _rows.addSeveral([row]);
    };

    /*
     * Ajoute des items au tableau
     */
    _rows.addSeveral = function(rows) {

        if (_rows.data.filtered.length === 0 && rows.length > 0) {
            $groups.find('> .cb-row.empty').remove();
        }

        for (var i in rows) {
            if(typeof rows[i][columnID] === "undefined") {
                console.error("Une valeur unique n'a pas été définie");
                break;
            }

            _rows.data.filtered.push(rows[i]);
        }

        _rows.print();
    };

    /*
     * Supprime un item au tableau
     */
    _rows.remove = function(item) {
        _rows.removeSeveral(item);
    };

    /*
     * Supprime plusieurs items au tableau
     */
     _rows.removeSeveral = function(ids) {
        if ( ! Array.isArray(ids)) ids = [ids];

        _rows.data.items = _rows.data.items.filter(item => ! ids.includes(item[columnID]));
        _rows.data.filtered = _rows.data.filtered.filter(item => ! ids.includes(item[columnID]));
        
        handleSelectedRows("remove", ids);

        if (_rows.data.items.length === 0) _rows.clear();

        _rows.setCache();
        _rows.print();
    };

    /*
     * Retourne l'index de la ligne
     * @param {int} id  ID de la colonne
     * @return {int}    Retourne l'index de la colonne. Retourne -1 en cas de colonne inconnue
     */
    _rows.getIndex = function(id) {
        return _rows.data.items.map(item => item[columnID]).indexOf(id);
    };

    _rows.clear = function() {
        _table.printTotals();

        if (settings.emptyDataMessage.length > 0) {
            $groups.append('<div class="empty cb-row">' + settings.emptyDataMessage + '</div>');
        }
    };

    _rows.updateSeveral = function(column, value, filter = null) {
        let items = _rows.data.items;

        if(typeof filter === "function") items = items.filter(filter);
        
        _rows.beginUpdate();
        items.forEach(item => {
            _rows.update(item[columnID], column, value);
        });
        _rows.endUpdate();
        
        _rows.print();
    };

    /*
     * Met à jour une ligne du tableau
     */
    _rows.update = function(id, column, value) {
        if(id instanceof jQuery) id = parseInt(id.data("id"));
        
        if (column instanceof Array) {
            if (value instanceof Array && value.length !== column.length) {
                console.warn('Les longueurs des colonnes et des valeurs ne correspondent pas.');
                return;
            }

            for (var i in column) {
                var val = value instanceof Array ? value[i] : value;
                _rows.updateCell(id, column[i], val);
            }
        }
        else if (typeof column === "object") {
            for (var col in column) {
                _rows.updateCell(id, col, column[col]);
            }
        }
        else {
            _rows.updateCell(id, column, value);
        }
        
        if(_rows.isUpdateProcessing === false) _rows.print();
    };
    
    _rows.beginUpdate = function() {
        _rows.isUpdateProcessing = true;
    };
    
    _rows.endUpdate = function() {
        _rows.isUpdateProcessing = false;
        _rows.print();
    };
    
    _rows.updateCurrent = function(column, value) {
        _rows.update(_rows.data.selected[0], column, value);
    };

    /*
     * Met à jour une cellule du tableau
     */
    _rows.updateCell = function(id, column, value) {
        if(id instanceof jQuery) id = id.data("id");
        
        let dataRow = _rows.getById(id);
        if(dataRow) {
            dataRow[column] = value;
            let dataFiltered = _rows.getById(id)[0];
            if(dataFiltered) dataFiltered[column] = value;
            
            if (typeof settings.onRowChanged === "function") settings.onRowChanged(_rows.data.idxs[id], dataRow);   
        }
    };

    _rows.getSeveralData = function(getter) {
        var data = [];

        if (typeof getter === "function") {
            $.each(_rows.data.items, function (idx, row) {
                if (getter(idx, row))
                    data.push(row);
            });
        } else if ($.isArray(getter)) {
            $.each(_rows.data.items, function (idx, row) {
                if ($.inArray(idx, getter) !== -1)
                    data.push(row);
            });
        } else {
            return false;
        }

        return data;
    };

    /*
     * Récupère les data d'une ligne
     */
    _rows.getData = function(item = false) {

        if (item instanceof jQuery) {
            item = item.index();
        }

        return isNaN(item) ? false : _rows.data.filtered[item];
    };
    
    /*
     * Récupère la node d'une ligne
     */
    function getStateCheckboxHeader(col) {
        return $thead.find('> div:nth(' + _column.getIndex(col) + ') > input').is(':checked');
    }




    /* GROUPES */



    _groups.set = function(...groups) {
        if(groups.length > 0) {
            _rows.data.group_id = {};
            _rows.data.idxs = {};
            _groups.formatter = false;
            _groups.printTotals = false;
            
            if(groups[0] !== false) {
                _groups.printed = true;
                _groups.data.items = [];
                
                groups.forEach((group, _index) => {
                    if(typeof group.column === "undefined") {
                        console.error("Aucune colonne définie comme groupe");
                        return false;
                    }
                    
                    let rows = _rows.data.filtered;
                    
                    group._index = _index;
                    
                    if(_index > 0) {
                        _groups.parseItems(_index, group, _groups.data.items);
                    }
                    else {
                        _groups.handleItems(group, _rows.data.filtered);
                    }

                    _groups.printTotals = typeof group.totals !== "undefined";
                });
                
                _groups.setRows();
                _table.setStyle();
            }
            else {
                $tbody.scrollTop(0);
                _rows.set();
            }
        }
        else {
            console.warn("Aucun paramètre reçu");
        }
    };
    
    _groups.parseItems = function(_index, group, rows, idx = 1) {
        if(idx < _index) {
            rows.forEach(_data => _groups.parseItems(_index, group, _data.rows, ++idx));
        }
        else {
            rows.forEach((parent_group, i) => _groups.handleItems(group, parent_group.rows, parent_group));
        }       
    };
    
    _groups.handleItems = function(defGroup, rows, _parent_group = null) {
        let _groups_by_index = [];
        let column = defGroup.column;
        let comparer = typeof defGroup.comparer === "undefined" ? "value ASC" : defGroup.comparer;
        let splitedComparer = comparer.split(' ');
        let compareTo = { ordering: "ASC" };
        let groupsList = _groups.data.items;
        
        if(_parent_group !== null) {
            _parent_group.rows = [];
            groupsList = _parent_group.rows;
        }
        
        for(var i in rows) {
            var row = rows[i];
            var group_index_str = [];
            let group_index = _groups_by_index.findIndex(value => value === row[column]);
            
            if(group_index === -1) {
                group_index = _groups_by_index.length;
                _groups_by_index.push(row[column]);
                groupsList.push({
                    _group: true,
                    _deep_index: defGroup._index,
                    _parent_index: _parent_group === null ? group_index : _parent_group._parent_index +'-'+ group_index,
                    value: row[column],
                    rows: [],
                    uniqueIds: [],
                    dropped: false,
                    count: 0
                });
            }
            
            row._parent_group = groupsList[group_index]._parent_index;
                
            groupsList[group_index].uniqueIds.push(row[columnID]);
            groupsList[group_index].count++;
            groupsList[group_index].rows.push(row);
        }
        

        compareTo.column = splitedComparer[0];
        if(splitedComparer.length === 2) {
            compareTo.ordering = splitedComparer[1];
        }
        
        let ascending = compareTo.ordering === "ASC" ? 1 : -1;
        
        if(_parent_group !== null) {
            _parent_group.orderedSubGroups
        }
        else {
            groupsList.sort(function(a,b) {
                if(a[compareTo.column] < b[compareTo.column]) {
                    return -1 * ascending;
                }
                if(a[compareTo.column] > b[compareTo.column]) {
                    return 1 * ascending;
                }
                return 0;
            });
        }

        if(typeof defGroup.totals !== "undefined") {
            for(var i in groupsList) {
                i = parseInt(i);
                var _group = groupsList[i];
                var totals = defGroup.totals.split(' ');
                var totals_row = {
                    _total: true,
                    _group_index: _group._index
                };
                
                for(var col in totals) {
                    totals_row[totals[col]] = {
                        value: 0,
                        column: totals[col]
                    };
                }
                
                for(var j in _group.rows) {
                    var row = _group.rows[j];

                    for(var y in totals) {
                        var col = totals[y];
                        if(!isNaN(row[col])) {
                            totals_row[col].value += row[col];
                        }
                    }
                }

                var uniqueId = "_total" + totals_row._group_index;
                _rows.data.idxs[uniqueId] = _group.rows.length;
                _rows.data.group_id[uniqueId] = _group._index;
                _group.rows.push(totals_row);
            }
        }

        if(typeof defGroup.formatter !== "undefined") {
            _groups.formatter = defGroup.formatter;
        }
    };

    _groups.setRows = function() {
        _rows.data.print = [];
        
        _groups.data.items.forEach(_groups.setRow);

        $groups.height(_rows.data.print.length * _table.row_height);
        
        _rows.print();
    };
    
    _groups.setRow = function(group, idx = 0) {
        group._index = idx;
        
        _rows.data.print.push(group);
        
        group.rows.forEach((row, index) => {
            if( ! group.dropped) return true;
            
            var uniqueId = row[columnID];
            
            _rows.data.idxs[uniqueId] = group._index + row._index;
            _rows.data.group_id[uniqueId] = group._index;
            
            idx++;
            row._index = idx;
            
            if(row._group === true) _groups.setRow(row, idx);
            else _rows.data.print.push(row);
        });
    };
    
    _groups.getGroup = function(group) {
        let _group;
        
        // Node jQuery
        if (group instanceof jQuery) {
            _group = _rows.getNode(group.data("index"), "group");
        }
        // Index ?
        else if(/\d((-\d)+)?/.test(group)) {
            _group = _rows.getNode(group, "group");
        }
        // Nom du groupe ?
        else {
            _group = _groups.data.items.find(item => item.value === group);
            if(_group) _group = _rows.getNode(_group._index, "group");
        }
        
        return _group;
    };

    /*
     * Affiche un groupe
     */
    _groups.drop = function(group) {
        handleCollapseOrDrop("drop", group);
    };

    /*
     * Cache un groupe
     */
    _groups.collapse = function(group) {
        handleCollapseOrDrop("collapse", group);
    };

    /* OUTILS */

    function formatColumnSum(column) {
        if (column.sum) {
            $tfoot.find("> div[data-column=" + column.id + ']').html(String(column.sumFormatter(getTotalColumn(column))).replace(/ /g, '&nbsp;').replace(/-/g, '&#8209;'));
        }
    };

    function getTotalColumn(column, calcWithValue = false) {
        var total = false;

        if (typeof column === "string") {
            column = _columns.get(column);
        }

        if (typeof column !== "undefined" && column.sum) {
            total = 0;
            for (var j in _rows.data.filtered) {
                var value;

                if (calcWithValue !== false && calcWithValue[columnID] === _rows.data.filtered[j][columnID]) {
                    value = calcWithValue.value;
                } else {
                    value = parseFloat(typeof _rows.data.filtered[j] === "undefined" ? 0 : _rows.data.filtered[j][column.id]);
                }

                if (isNaN(value)) {
                    value = 0;
                }

                total += value;
            }
        }

        return total;
    }

    function search(type, selectors, needle = "", return_idxs = false, filteredRows = false) {
        var idxs = [];
        function match_search(row, idx) {
            var matching = false;
            var regexp = new RegExp('^' + needle, 'i');

            if (selectors instanceof Array && selectors.length > 0) {

                // On recherche des identifiants
                if (isNaN(selectors[0])) {
                    matching = selectors.some(function (selector) {
                        return typeof row[selector] === "string" && String(row[selectors]).match(regexp) !== null;
                    });
                }
                // On recherche des indexes
                else {
                    matching = selectors.includes(String(row[columnID])) || selectors.includes(parseInt(row[columnID]));
                }
            }
            // Recherche sur plusieurs colonnes => {col: value, col2, value2, ...}
            else if (typeof selectors === "object") {
                for (var column in selectors) {
                    var comparator = selectors[column];
                    var value = typeof comparator === "object" ? comparator.value : comparator;
                    var equal = typeof comparator === "object" ? comparator.equal : true;
                    if (typeof row[column] !== "undefined") {
                        if (value instanceof Array) {
                            for (var j in value) {
                                matching = compareValues(row[column], value[j], equal);

                                if (matching === true) {
                                    break;
                                }
                            }
                        } else {
                            matching = compareValues(row[column], value, equal);
                        }
                    }

                    // On arrête la boucle puisqu'au moins 1 élément ne correspont aux critères
                    if (matching === false) {
                        break;
                    }
                }
            }
            else if (typeof selectors === "string" && typeof row[selectors] !== "undefined") {
                matching = String(row[selectors]).match(regexp) !== null;
            }
            else if (isNaN(selectors) === false) {
                matching = idx == selectors;
            }
            
            if (matching) idxs.push(idx);
            
            return matching;
        }

        function compareValues(a, b, equal = true) {
            var compare = String(a).match(new RegExp('^' + b + '$', 'i'));

            return equal ? compare !== null : compare === null;
        }

        var data = {filter: {}, idxs: {}};
        if (settings.groups && type === "rows") {
            var selected_rows_grp = selectors;
            for (var idx_grp in selected_rows_grp) {
                selectors = selected_rows_grp[idx_grp];
                data.filter[idx_grp] = typeof _rows.data.items[idx_grp].list === "undefined" ? [] : _rows.data.items[idx_grp].list.filter(match_search);
                data.idxs[idx_grp] = idxs;
                idxs = [];
            }
        }
        else {
            var search_array = type === "rows" ? (filteredRows ? _rows.data.filtered : _rows.data.items) : _groups.data.items;
            let indexById = Object.fromEntries(search_array.map((item, index) => [ item[columnID], index ]));
            data.filter = search_array.filter(typeof selectors === "function" ? selectors : match_search);
            data.idxs = [];
            
            let idsFilter = data.filter.map(item => parseInt(item[columnID]));
            for(var id in indexById) {
                id = parseInt(id);
                if(idsFilter.includes(id)) data.idxs.push(id);
            }

            if (type === "rows") {
                data.filter = {0: data.filter};
                data.idxs = {0: data.idxs};
            }
        }
        return return_idxs ? data : data.filter;
    }

    function filter(selectors, string) {
        var data_filtered = [];

        if(selectors === false) {
            data_filtered = _rows.data.items;
        } else {
            var rowsFilter = search("rows", selectors, string, true);
            data_filtered = settings.groups ? rowsFilter.filter : rowsFilter.filter[0];
        }

        _rows.data.filtered = data_filtered;
        _rows.print();
    };

    /*
     * Ordonne le tableau en fonction de la sélection
     * @param Boolean order
     */
    function orderRowsBySelectionState(order = null) {

        if (order === null) {
            return;
        }

        var ids_rows_ordered;
        var rows_ordered = [];
        var _unselected_ids = _rows.getUnselectedIds();
        var _selected_ids = _rows.getSelectedIds();

        if (order === false)
        {
            ids_rows_ordered = _unselected_ids.concat(_selected_ids);
        } else if (order === true)
        {
            ids_rows_ordered = _selected_ids.concat(_unselected_ids);
        }

        for (var i in ids_rows_ordered) {
            var row = _rows.data.items.find(function (item) {
                return ids_rows_ordered[i] === item[columnID];
            });

            if (typeof row !== "undefined") {
                rows_ordered.push(row);
            }
        }

        _rows.data.filtered = rows_ordered;
        _rows.print();
    }

    function handleSelectedRows(action, idx_row) {
        if(action === false) {
            _rows.data.selected = [];
            _groups.data.selected = [];
        }
        else if (action === true) {
            action = "add";

            for (var i in _rows.data.filtered) {
                _rows.data.selected = handleSelection(_rows.data.selected, _rows.data.filtered[i][columnID]);
            }
        } else {
            _rows.data.selected = handleSelection(_rows.data.selected);
        }

        function handleSelection(array, idx_to_handle = null) {

            if (idx_to_handle === null) {
                idx_to_handle = parseInt(idx_row);
            }

            if (action === "add") {
                if (settings.multipleSelection) {
                    if (array.includes(idx_to_handle) === false) {
                        array.push(idx_to_handle);
                    }
                } else {
                    array = [idx_to_handle];
                }
            } else if (action === "remove") {
                array = $.grep(array, function (row) {
                    return idx_to_handle instanceof Array ? idx_to_handle.includes(row) === false : row !== idx_to_handle;
                });
            }

            return array;
        }
    }

    function print(opts) {

        var opts_default = {
            type: "PDF",
            title: null,
            name: "Impression",
            action: "download",
            columns: null,
            showDateTime: false,
            addDateInFilename: false,
            addDateTimeInFilename: false,
            showSelectedColumn: true,
            onlySelectedRows: false,
            orientation: 'P',
            save_path: ''
        };
        var opts_print = $.extend({}, opts_default, opts);
        
        if(opts_print.orientation === "landscape" || opts_print.orientation === "paysage") opts_print.orientation = 'L';
        if(opts_print.orientation === "portrait") opts_print.orientation = 'P';
        
        var page_width = opts_print.orientation === 'L' ? 277 : 200;
        var fullDate = new Date();
        var date_string = (fullDate.getDate() < 10 ? '0' : '') + fullDate.getDate() +
                (fullDate.getMonth() + 1 < 10 ? '0' : '') + (fullDate.getMonth() + 1) +
                fullDate.getFullYear();
        var time_string = (fullDate.getHours() < 10 ? '0' : '') + fullDate.getHours() +
                'H' +
                (fullDate.getMinutes() < 10 ? '0' : '') + fullDate.getMinutes();

        if (opts_print.title === null) opts_print.title = opts_print.name;

        // On nettoie le nom du fichier
        opts_print.name = opts_print.name.toLowerCase()
                .split(' ')
                .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
                .join(' ');
        opts_print.name = opts_print.name.replace(/ /g, '');
        opts_print.name = opts_print.name.replace(/\//g, '');
        opts_print.name = opts_print.name.replace(/\\/g, '');
        opts_print.name = opts_print.name.replace(/:/g, '');
        opts_print.name = opts_print.name.replace(/\*/g, '');
        opts_print.name = opts_print.name.replace(/\?/g, '');
        opts_print.name = opts_print.name.replace(/\"/g, '');
        opts_print.name = opts_print.name.replace(/\</g, '');
        opts_print.name = opts_print.name.replace(/\>/g, '');
        opts_print.name = opts_print.name.replace(/\|/g, '');

        if (opts_print.addDateTimeInFilename) {
            opts_print.name += '_' + date_string + '_' + time_string;
        } else if (opts_print.addDateInFilename) {
            opts_print.name += '_' + date_string;
        }

        var cols_ids = [];
        var columns = [];
        var data = {
            action: opts_print.action, // Orientation de l'impression
            file_type: opts_print.type,
            file_orientation: opts_print.orientation, // Orientation de l'impression
            file_width: page_width, // Titre de la page
            file_title: opts_print.title, // Nom du fichier
            file_name: opts_print.name, // Action à effectuer : download / ( save => sauvegarde dans asset/userfile/export )
            show_datetime: opts_print.showDateTime, // Affiche la date et l'heure de l'impression dans la page
            save_path: opts_print.save_path, // Chemin de sauvegarde du fichier
            headers: [], // Identifiants des colonnes
            headersNames: [], // Nom des colonnes
            colsJustify: [], // Jutification du texte des colonnes
            headersWidth: [], // Taille des en-têtes
            headersJustify: [], // Justification du texte des en-têtes
            rows: [], // Données du tableau
            colsSum: {} // Colonnes avec somme
        };

        /*
         * Récupération des colonnes
         */

        // Si les lignes sont sélectionnables, on ajoute la colonne de sélection
        if (settings.rowsCheckable && opts_print.showSelectedColumn) {
            columns = [{
                id: "_selected",
                name: "S&eacute;l.",
                width: 50,
                justif: 'C',
                header: { justif: 'C' }
            }];
        }

        // On concatène avec les colonnes définies
        columns = columns.concat(_columns.data.items);

        // Calcul de la longueur totale des colonnes
        var totalWidthColumns = Helpers.Array.sum(columns.map(col => calcWidth(col.width)));

        for (var i in columns) {
            var column = columns[i];

            if (isColumnIgnored(column)) continue;

            if (column.sum) data.colsSum[column.id] = 0;

            data.headers.push(column.id);
            data.headersNames.push(column.name);
            data.colsJustify.push(column.justif);
            data.headersWidth.push((page_width * calcWidth(column.width)) / totalWidthColumns);
            data.headersJustify.push(column.header.justif);

            cols_ids.push(column.id);
        }

        /*
         * Récupération des données
         */

        for (var i in _rows.data.filtered) {
            var row = _rows.data.filtered[i];

            if (settings.rowsCheckable && opts_print.showSelectedColumn) {
                row._selected = _rows.data.selected.includes(row[columnID]) ? "on" : '';
            }

            // On récupère seulement les valeurs des colonnes spécifiées
            for (var j in cols_ids) {
                if (typeof data.rows[i] === "undefined") {
                    data.rows[i] = {};
                }

                var value = typeof row[cols_ids[j]] === "undefined" || row[cols_ids[j]] === null ? '' : row[cols_ids[j]];
                data.rows[i][cols_ids[j]] = value;

                if (typeof data.colsSum[cols_ids[j]] !== "undefined" && isNaN(value) === false) {
                    data.colsSum[cols_ids[j]] += parseFloat(value);
                }
            }
        }
        
        let controller;
        if(opts_print.type === "PDF") {
            controller = "common/printGridTable";
        }
        else {
            controller = "common/exportGridTable";
        }
        
        if (opts_print.action === "download") {
            let tmp;
            var $form = $('<form method="post" action="'+ siteUrl +'/'+ controller +'"></form>');

            // On empêche le blocage du popup indiquant de quitter la page
            // Fenêtre principale
            if(window.opener === null) preventFromExit = false;
            // Fenêtres avec blocage - Gestion
            if(typeof typeFenetre !== "undefined") {
                tmp = alertOnClose;
                alertOnClose = false;
            }

            dataToForm(data);

            $table.after($form);
            $form.submit();
            $form.remove();

            setTimeout(function() {
                // Fenêtre principale
                if(window.opener === null) preventFromExit = true;
                // Fenêtres avec blocage - Gestion
                if(typeof typeFenetre !== "undefined") alertOnClose = tmp;
            }, 50);

            // Créé un formulaire à partir d'un tableau de données
            function dataToForm(items, parent_key = '') {
                for (var key in items) {
                    var item = items[key];

                    if (parent_key.length > 0) {
                        key = '[' + key + ']';
                    }

                    if (item instanceof Array || typeof item === "object") {
                        dataToForm(item, parent_key + key);
                    } else {
                        $form.append('<input type="hidden" name="' + parent_key + key + '" value="' + item + '"/>');
                    }
                }
            }
        }
        else if (opts_print.action === "save") {
            ajax.url(controller).send(data);
        }

        // Ignore les colonnes non spécifiée
        // La colonne de sélection est ignorée si l'option "showSelectedColumn" est à FALSE
        function isColumnIgnored(column) {
            return opts_print.columns instanceof Array && ((column.id !== "_selected" && opts_print.columns.includes(column.id) === false) || opts_print.showSelectedColumn === false)
        }

        function calcWidth(width) {
            // Pourcentage ?
            if (isNaN(width)) {
                width = $table.width() * (parseInt(width) / 100);
            }

            return width;
        }
    }

    // Construit l'éditeur de la colonne
    function getEditor(column, data, args) {
        if(column.editor === false) return false;

        var editor = typeof column.editor !== "string" ? column.editor.name : column.editor;
        var splited = editor.split('.');
        var element = splited[0];
        var type = splited.length > 1 ? splited[1] : "text";
        
        // On a indiqué l'attribut "type" de input
        if(element !== "input" && element !== "select") {
            type = element;
            element = "input";
        }

        var editorData = column.editor;
        var editorNode = document.createElement(element);
        var value = '';
        let visible = true;

        if (typeof data !== "undefined") {
            var col_id = element === "input" || typeof column.editor.column === "undefined" ? column.id : column.editor.column;
            value = data[col_id];
        }

        if(typeof editorData === "object") {
            if (typeof editorData.attributes !== "undefined") {
                for (var name in editorData.attributes) editorNode[name] = editorData.attributes[name];
            }
            if (typeof editorData["bg-color"] !== "undefined") {
                editorNode.style.backgroundColor = editorData["bg-color"];
            }
            if(typeof data !== "undefined" && element === "select") {
                var opts = getEditorOptions(editorData, value, true);
                value = getEditorValue(editorData, value);

                for(var i in opts) {
                    var selected = opts[i] == value ? " selected" : '';
                    let optionNode = document.createElement("option");
                    
                    optionNode.setAttribute("value", i);
                    optionNode.innerText = opts[i];
                    if(selected) optionNode.setAttribute("selected", "selected");                    
                    editorNode.appendChild(optionNode);
                }
            }
            if(typeof editorData.visible === "function") {
                visible = editorData.visible(args.index, value, data, column, args.node);
            }
        }

        if(typeof args !== "undefined" && typeof data !== "undefined") {
            value = column.formatter(args.index, value, data, column, args.node);
        }
        
        editorNode.setAttribute("value", value);
        editorNode.setAttribute("name", "input_" + column.id);
        editorNode.setAttribute("type", type);
        editorNode.style.textAlign = column.justif === 'R' ? 'right' : (column.justif === 'C' ? 'center' : 'left');
        
        return {
            element: element,
            type: type,
            options: opts,
            permanent: column.editorAlwaysVisible === true,
            value: value,
            html: visible ? editorNode.outerHTML : '',
            visible: visible
        };
    }

    function getEditorOptions(editor, value, filter = false) {
        var opts = typeof editor.options === "function" ? editor.options() : editor.options;

        if(filter && typeof editor.filter !== "undefined") {
            var tmp_opts = {};
            for(var i in opts) {
                if(editor.filter(value, opts[i], i)) {
                    tmp_opts[i] = opts[i];
                }
            }
            opts = tmp_opts;
        }

        if(typeof editor.value !== "undefined" && typeof editor.text !== "undefined") {
            var tmp_opts = {};
            for(var i in opts) {
                tmp_opts[opts[i][editor.value]] = opts[i][editor.text];
            }
            opts = tmp_opts;
        }

        return opts;
    }

    // Récupère la valeur de l'éditeur de type "select"
    function getEditorValue(editor, value) {
        var opts = getEditorOptions(editor, value);
        return typeof opts[value] === "undefined" ? '' : opts[value];
    }
    
    function setTableEditable(state) {
        settings.editable = state;
    }




    /*
     *
     * FONCTIONS DES COLONNES
     *
     */
    
    function formatValueForSort(column, value) {
        let formattedValue = value;
        let emptyValue = typeof value === "undefined" || value === null || value === "null";
        let type = "string";
        
        if(emptyValue === false) {
            if(isNaN(value)) {
                type = "string";
            }
            else if(value.toString().indexOf('.') > -1) {
                type = "float";
            }
            else {
                type = "int";
            }
        }

        if(typeof column !== "undefined") {
            if(emptyValue === false && typeof column.type === "undefined") {
                column.type = type;
            }
            if(column.type) type = column.type;
        }

        switch(type) {
            case "string":
                if(emptyValue) return '';
                formattedValue = formattedValue.toLowerCase();
                break;
            case "date":
                if(emptyValue) return '';
                
                var full_date = value.split(' ');
                var date = '';
                var hours = '';

                date = full_date[0].split('/');
                date = date[2] + date[1] + date[0];

                if(full_date.length > 1) {
                    hours = full_date[1];
                }

                formattedValue = date + ' ' + hours;
                break;
                
            case "float":
                formattedValue = parseFloat(formattedValue);
                if(emptyValue || isNaN(formattedValue)) return 0.00;
                break;
                
            case "int":
                formattedValue = parseInt(formattedValue);
                if(emptyValue || isNaN(formattedValue)) return 0;
                break;
        }
        
        return formattedValue;
    };

    /*
     * Gère les actions sur les groupes
     */
    function handleCollapseOrDrop(type, group) {
        var _group = _groups.getGroup(group);
        
        if(typeof _group !== "undefined") {
            _group.dropped = type === "drop";
            _groups.setRows();
        }
    }

    _table.init();

    return {        
        /* SELECTION */
        "deselectItems": _rows.deselect,
        "selectItems": _rows.select,
        "selectAll": () => {
            _rows.select(true);
        },

        /* GETTERS */
        "getColumn": _columns.get,
        "getColumns": _columns.getAll,
        "getColumnIdx": _column.getIndex,
        "getTotalColumn": getTotalColumn,
        "getItems": _rows.getSeveral,
        "getGroup": _groups.getGroup,
        "getFilteredItems": _rows.getFilteredItems,
        "getItemById": _rows.getById,
        "getItemsByIdx": _rows.getByIdx,
        "getItemIdx": _rows.getIndex,
        "getFilteredSelectedIds": _rows.getFilteredSelectedIds,
        "getFilteredSelectedItems": _rows.getFilteredSelectedItems,
        "getSelectedIds": _rows.getSelectedIds,
        "getSelectedItems": _rows.getSelectedItems,
        "getUnselectedIds": _rows.getUnselectedIds,
        "getUnselectedItems": _rows.getUnselectedItems,
        "getNodes": _rows.getNodes,
        "getDataItem": _rows.getData,
        "getDataItems": _rows.getSeveralData,
        "getStateCheckboxHeader": getStateCheckboxHeader,
        "filter": filter,
        "getCache": () => {
            return {
                idxs: _rows.data.idxs,
                ids: _rows.data.rowById
            };
        },

        /* HEADERS */
        "propCheckHeader": propCheckHeader,
        "triggerCheckHeader": triggerCheckHeader,
        "changeAndTriggerCheckHeader": changeAndTriggerCheckHeader,

        /* SETTERS */
        "setData": _rows.set,
        "updateItem": _rows.update,
        "updateCurrentItem": _rows.updateCurrent,
        "updateItems": _rows.updateSeveral,
        "addItem": _rows.add,
        "addItems": _rows.addSeveral,
        "removeItem": _rows.remove,
        "removeItems": _rows.removeSeveral,
        "editable": setTableEditable,
        "setColumns": _columns.set,
        "addColumn": _columns.add,
        "removeColumn": _columns.remove,
        "updateColumn": _columns.update,
        "setGrouping": _groups.set,

        /* HANDLERS */
        "resize": _table.resize,
        "dropGroup": _groups.drop,
        "collapseGroup": _groups.collapse,
        "orderRowsBySelectionState": orderRowsBySelectionState,
        "sort": _rows.sort,
        "beginUpdate": _rows.beginUpdate,
        "endUpdate": _rows.endUpdate,

        /* EVENTS */
        "onRowsPrint": onRowsPrint,
        "onColumnResized": onColumnResized,
        "onClickRow": onClickRow,
        "onGlobalSelection": onGlobalSelection,
        "onGroupDrop": onGroupDrop,
        "onGroupCollapse": onGroupCollapse,
        "onRowUpdate": onRowUpdate,
        "onEditCell": onEditCell,
        "onSelectedRow": onSelectedRow,
        "onSelectedRowsCountChange": onSelectedRowsCountChange,

        /* EXPORT */
        "print": print
    };


    /* PROTOTYPES */


    Element.prototype.setAttributes = function(attributes) {
        for(var i in attributes) {
            this.setAttribute(i, attributes[i]);
        }
    };

}