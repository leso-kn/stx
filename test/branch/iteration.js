const test = require('tape')
const { Struct } = require('../../')

test('branches - forEach', t => {
  const master = new Struct({
    articles: {
      first: {
        title: 'First Article'
      },
      second: {
        title: 'Second Article'
      }
    }
  })

  const branch1 = master.create({
    articles: {
      third: {
        title: 'Third Article'
      }
    }
  })

  const branch2 = branch1.create({
    articles: {
      first: {
        favourite: true
      },
      third: {
        favourite: true
      }
    }
  })

  t.same(
    master.serialize(),
    {
      articles: {
        first: { title: 'First Article' },
        second: { title: 'Second Article' }
      }
    },
    'master.serialize() is correct'
  )
  t.same(
    branch1.serialize(),
    {
      articles: {
        first: { title: 'First Article' },
        second: { title: 'Second Article' },
        third: { title: 'Third Article' }
      }
    },
    'branch1.serialize() is correct'
  )
  t.same(
    branch2.serialize(),
    {
      articles: {
        first: { favourite: true, title: 'First Article' },
        second: { title: 'Second Article' },
        third: { favourite: true, title: 'Third Article' }
      }
    },
    'branch2.serialize() is correct'
  )

  const masterArray = []
  master.get('articles').forEach((article, id) => {
    article.forEach((prop, propName) => {
      masterArray.push([id, propName, prop.compute()])
    })
  })

  const branch1Array = []
  branch1.get('articles').forEach((article, id) => {
    article.forEach((prop, propName) => {
      branch1Array.push([id, propName, prop.compute()])
    })
  })

  const branch2Array = []
  branch2.get('articles').forEach((article, id) => {
    article.forEach((prop, propName) => {
      branch2Array.push([id, propName, prop.compute()])
    })
  })

  t.same(
    masterArray,
    [
      [ 'first', 'title', 'First Article' ],
      [ 'second', 'title', 'Second Article' ]
    ],
    'master has correct keys'
  )
  t.same(
    branch1Array,
    [
      [ 'third', 'title', 'Third Article' ],
      [ 'first', 'title', 'First Article' ],
      [ 'second', 'title', 'Second Article' ]
    ],
    'branch1 has correct keys'
  )
  t.same(
    branch2Array,
    [
      [ 'third', 'favourite', true ],
      [ 'third', 'title', 'Third Article' ],
      [ 'first', 'favourite', true ],
      [ 'first', 'title', 'First Article' ],
      [ 'second', 'title', 'Second Article' ]
    ],
    'branch2 has correct keys'
  )

  t.end()
})

test('branches - filter - map', t => {
  const master = new Struct({
    articles: {
      first: {
        favourite: false,
        name: 'first'
      },
      second: {
        favourite: false,
        name: 'second'
      }
    }
  })

  const branch1 = master.create()
  branch1.get('articles').set({
    third: {
      name: 'third',
      favourite: true
    }
  })

  const branch2 = branch1.create({
    articles: {
      first: {
        favourite: true
      },
      second: {
        favourite: true
      },
      third: {
        favourite: false
      }
    }
  })

  t.same(
    master
      .get('articles')
      .filter(item => item.get('favourite').compute())
      .map(item => item.get('name').compute()),
    [],
    'master.articles.filter() = []'
  )
  t.same(
    branch1
      .get('articles')
      .filter(item => item.get('favourite').compute())
      .map(item => item.get('name').compute()),
    [ 'third' ],
    'branch1.articles.filter() = [ third ]'
  )
  t.same(
    branch2
      .get('articles')
      .filter(item => item.get('favourite').compute())
      .map(item => item.get('name').compute()),
    [ 'first', 'second' ],
    'branch2.articles.filter() = [ first, second ]'
  )

  t.end()
})
