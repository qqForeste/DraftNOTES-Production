import Highcharts from 'highcharts'

Highcharts.setOptions({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif' },
  },
  credits: { enabled: false },
  title: { text: undefined },
})

export { Highcharts }
