const mapsRender = () => {
    const $el = document.querySelector('#viewContainer')

    ymaps.ready(init)

    function init() {
        const $btn = document.querySelector('#suggestSubmit'),
            $btnIcon = $btn.querySelector('[delivery-icon]'),
            $dataAddress = document.querySelector('[data-address-data]'),
            delivery = +$el.dataset.delivery,
            deliveryTariff = +$el.dataset.deliveryTariff,
            routeMax = +$el.dataset.routeMax,
            addressSklad = $el.dataset.storage,
            $input = document.querySelector('#suggest'),
            $message = document.querySelector('#message'),
            $tooltipError = document.querySelector('#tooltipError'),
            $mapWrap = document.querySelector('.map-wrap'),
            classListBtnIcon = () => {
                const $class = ['swap_calls', 'delete_forever']

                $btnIcon.innerHTML =
                    $btnIcon.innerHTML === $class[0] ? $class[1] : $class[0]

                $mapWrap.classList.toggle('open')
            }

        // Подключаем поисковые подсказки к полю ввода.
        let suggestView = new ymaps.SuggestView('suggest'),
            map,
            myMap,
            placemark

        if ($dataAddress) {
            $dataAddress.addEventListener('click', (e) => {
                $input.value = e.target.innerHTML
                e.target.removeAttribute('data-address-data')
            })
        }

        document.querySelector('ymaps').addEventListener('click', (e) => {
            e.preventDefault()
            geocode(e)
        })

        $btn.addEventListener('click', (e) => {
            e.preventDefault()
            if (!map) {
                geocode(e)
            } else {
                _mapDestroy(e)
            }
        })

        function geocode() {
            // Забираем запрос из поля ввода.
            let request = document.querySelector('#suggest').value

            if (request.length < 5) return

            if (!map) classListBtnIcon()

            $message.innerHTML = 'Загрузка...'

            // Геокодируем введённые данные.
            ymaps.geocode(request).then(
                function (res) {
                    let obj = res.geoObjects.get(0),
                        error,
                        hint

                    if (obj) {
                        switch (
                            obj.properties.get(
                                'metaDataProperty.GeocoderMetaData.precision'
                            )
                        ) {
                            case 'exact':
                            case 'other': // 'other' удалить в корзине
                                break
                            case 'number':
                            case 'near':
                            case 'range':
                                error = 'Неточный адрес, требуется уточнение'
                                hint = 'Уточните номер дома'
                                break
                            case 'street':
                                error = 'Неполный адрес, требуется уточнение'
                                hint = 'Уточните номер дома'
                                break
                            case 'other':
                            default:
                                error = 'Неточный адрес, требуется уточнение'
                                hint = 'Уточните адрес'
                        }
                    } else {
                        error = 'Адрес не найден'
                        hint = 'Уточните адрес'
                    }

                    // Если геокодер возвращает пустой массив или неточный результат, то показываем ошибку.
                    if (error) {
                        showError(error)
                        showMessage(hint)
                        classListBtnIcon()
                        map.destroy()
                        map = null
                        myMap.destroy()
                        myMap = null
                    } else {
                        showResult(obj)
                    }
                },
                function (e) {
                    if (e && e.message === 'scriptError') {
                        _mapDestroy()
                    }
                    console.log(e)
                }
            )
        }

        function showResult(obj) {
            // Удаляем сообщение об ошибке, если найденный адрес совпадает с поисковым запросом.
            $input.classList.remove('input_error')
            $tooltipError.textContent = ''
            $tooltipError.style.display = 'none'

            let mapContainer = document.querySelector('#map'),
                bounds = obj.properties.get('boundedBy'),
                // Рассчитываем видимую область для текущего положения пользователя.
                mapState = ymaps.util.bounds.getCenterAndZoom(bounds, [
                    mapContainer.offsetWidth,
                    mapContainer.offsetHeight,
                ]),
                // Сохраняем полный адрес для сообщения под картой.
                address = [obj.getCountry(), obj.getAddressLine()].join(', '),
                // Сохраняем укороченный адрес для подписи метки.
                shortAddress = [
                    obj.getThoroughfare(),
                    obj.getPremiseNumber(),
                    obj.getPremise(),
                ].join(' ')
            // Убираем контролы с карты.
            mapState.controls = []
            // Создаём карту.
            createMap(mapState, shortAddress)
            // Расчитываем длину маршрута
            multiRoute(address)
        }

        function showError(message) {
            $input.classList.add('input_error')
            $tooltipError.textContent = message
            $tooltipError.style.display = 'block'
        }

        function createMap(state, caption) {
            // Если карта еще не была создана, то создадим ее и добавим метку с адресом.
            if (!map) {
                map = new ymaps.Map('map', state)
                placemark = new ymaps.Placemark(
                    map.getCenter(),
                    {
                        iconCaption: caption,
                        balloonContent: caption,
                    },
                    {
                        preset: 'islands#redDotIconWithCaption',
                    }
                )
                map.geoObjects.add(placemark)

                // Если карта есть, то выставляем новый центр карты и меняем данные и позицию метки в соответствии с найденным адресом.
            } else {
                map.setCenter(state.center, state.zoom)
                placemark.geometry.setCoordinates(state.center)
                placemark.properties.set({
                    iconCaption: caption,
                    balloonContent: caption,
                })
            }
        }

        function showMessage(message) {
            $message.innerHTML = message
        }

        function multiRoute(address) {
            myMap = new ymaps.Map('mapHidden', {
                center: [59.939095, 30.315868],
                zoom: 9,
                controls: [],
            })
            let routePanelControl = new ymaps.control.RoutePanel()

            // Пользователь сможет построить только автомобильный маршрут.
            routePanelControl.routePanel.options.set({
                types: { auto: true },
            })

            routePanelControl.routePanel.state.set({
                fromEnabled: false,
                from: addressSklad,
                to: address,
                type: 'auto',
            })

            myMap.controls.add(routePanelControl)

            routePanelControl.routePanel.getRouteAsync().then(function (route) {
                route.model.setParams({ results: 1 }, true)

                // Повесим обработчик на событие построения маршрута.
                route.model.events.add('requestsuccess', function () {
                    let activeRoute = route.getActiveRoute()
                    if (activeRoute) {
                        // Получим протяженность маршрута.
                        let length = route
                            .getActiveRoute()
                            .properties.get('distance')
                        // Вычислим стоимость доставки.
                        let price = calculate(Math.round(length.value / 1000))

                        if (!price) {
                            showError(
                                'Доставка по указанному адресу не осуществляется'
                            )
                            price = 0
                            classListBtnIcon()
                            map.destroy()
                            map = null
                            myMap.destroy()
                            myMap = null
                        }
                        // Создадим макет содержимого балуна маршрута.
                        let message = 'Стоимость доставки: ' + price + ' руб.'

                        showMessage(message)

                        setCartDeliveryPrice(price)
                    }
                })
            })
        }

        function setCartDeliveryPrice(price = null) {
            const $totalSum = document.querySelector('#goodsSum'),
                $totalOldSum = document.querySelectorAll('[data-totaloldsum]'),
                $deliverySum = document.querySelectorAll('[data-deliverysum]')

            if ($totalSum !== null) {
                let sum = isNaN(+price) ? 0 : price
                const totalSum = Math.round(
                    sum + +$totalSum.getAttribute('data-totalsum')
                )

                $totalOldSum.forEach((item) => {
                    item.innerHTML = new Intl.NumberFormat('ru-RU').format(
                        totalSum
                    )
                    item.setAttribute('data-totaloldsum', totalSum)
                })
                $deliverySum.forEach((item) => {
                    if (item.tagName === 'INPUT') {
                        item.value = sum
                    } else {
                        item.innerHTML = new Intl.NumberFormat('ru-RU').format(
                            sum
                        )
                    }
                })
            }
        }

        // Функция, вычисляющая стоимость доставки.
        function calculate(routeLength) {
            if (
                routeLength > routeMax ||
                routeLength * deliveryTariff > 10000
            ) {
                return false
            }

            return Math.max(_numRaund(routeLength * deliveryTariff), delivery)
        }

        function _numRaund(num) {
            if (!isNaN(+num)) return Math.round(+num / 100) * 100
            return false
        }

        function _mapDestroy() {
            setCartDeliveryPrice()
            map.destroy()
            map = null
            myMap.destroy()
            myMap = null
            $message.innerHTML = '&nbsp;'
            $input.value = ''
            $input.classList.remove('input_error')
            $tooltipError.textContent = ''
            $tooltipError.style.display = 'none'
            classListBtnIcon()
        }
    }

    const $cartForm = document.querySelector('#cartForm')

    if ($cartForm !== null) {
        _radioCheck('#deliveryValue', 'data-storage')
        _radioCheck('#paymentsId', 'data-payments')
    }

    function _radioCheck(el, dataAtr) {
        const $elValue = $cartForm.querySelector(el)
        if ($elValue !== null) {
            $cartForm.addEventListener('change', (e) => {
                const $this = e.target

                if ($this.hasAttribute(dataAtr)) {
                    $elValue.value = $this.getAttribute(dataAtr)
                }
            })
        }
    }
}

mapsRender()
